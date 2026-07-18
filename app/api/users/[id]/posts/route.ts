import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { toPostDTO, computeLikedSet } from "@/lib/posts";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/users/[id]/posts">,
) {
  const { id: userId } = await ctx.params;

  const author = await prisma.user.findUnique({ where: { id: userId } });
  if (!author) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const viewer = await getCurrentUser();
  const posts = await prisma.post.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: true, product: true },
  });
  const likedSet = await computeLikedSet(
    prisma,
    viewer?.id ?? null,
    posts.map((p) => p.id),
  );

  return NextResponse.json({
    user: { id: author.id, email: author.email },
    posts: posts.map((p) => toPostDTO(p, likedSet.has(p.id))),
  });
}
