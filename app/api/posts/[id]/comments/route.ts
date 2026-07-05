import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertUser, AuthError } from "@/lib/auth/guards";
import { checkContent } from "@/lib/moderation";

const BodySchema = z.object({ text: z.string().min(1).max(500) });

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/posts/[id]/comments">,
) {
  let user;
  try {
    user = assertUser(await getCurrentUser());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { id: postId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const moderation = checkContent(parsed.data.text);
  if (!moderation.allowed) {
    return NextResponse.json({ error: moderation.reason }, { status: 422 });
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { postId, authorId: user.id, text: parsed.data.text },
      include: { author: true },
    }),
    prisma.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } }),
  ]);

  return NextResponse.json({
    comment: {
      id: comment.id,
      text: comment.text,
      author: { id: comment.author.id, email: comment.author.email },
      createdAt: comment.createdAt.toISOString(),
    },
  });
}

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/posts/[id]/comments">,
) {
  const { id: postId } = await ctx.params;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { author: true },
  });
  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      text: c.text,
      author: { id: c.author.id, email: c.author.email },
      createdAt: c.createdAt.toISOString(),
    })),
  });
}
