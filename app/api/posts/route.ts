import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertUser, AuthError } from "@/lib/auth/guards";
import { normalizeHashtag } from "@/lib/hashtag";
import { checkContent } from "@/lib/moderation";
import { toPostDTO, computeLikedSet } from "@/lib/posts";

const ProductSchema = z.object({
  title: z.string().min(1).max(120),
  category: z.string().min(1).max(60),
  price: z.number().int().min(0),
  tags: z.array(z.string()).max(10).default([]),
  imageUrl: z.string().url().optional(),
});

const CreatePostSchema = z.object({
  text: z.string().min(1).max(2000),
  hashtags: z.array(z.string()).max(10).default([]),
  imageUrl: z.string().url().optional(),
  product: ProductSchema.optional(),
});

export async function POST(request: Request) {
  let user;
  try {
    user = assertUser(await getCurrentUser());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = CreatePostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const hashtags = parsed.data.hashtags.map(normalizeHashtag);
  const moderation = checkContent([parsed.data.text, ...hashtags].join(" "));
  if (!moderation.allowed) {
    return NextResponse.json({ error: moderation.reason }, { status: 422 });
  }

  const product = parsed.data.product
    ? await prisma.product.create({ data: parsed.data.product })
    : null;

  const post = await prisma.post.create({
    data: {
      authorId: user.id,
      text: parsed.data.text,
      hashtags,
      imageUrl: parsed.data.imageUrl,
      source: "free",
      productId: product?.id,
    },
    include: { author: true, product: true },
  });

  return NextResponse.json({ post: toPostDTO(post, false) });
}

export async function GET() {
  const user = await getCurrentUser();
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: true, product: true },
  });
  const likedSet = await computeLikedSet(
    prisma,
    user?.id ?? null,
    posts.map((p) => p.id),
  );
  return NextResponse.json({
    posts: posts.map((p) => toPostDTO(p, likedSet.has(p.id))),
  });
}
