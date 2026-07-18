import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizeHashtag } from "@/lib/hashtag";
import { toPostDTO, computeLikedSet } from "@/lib/posts";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/topics/[tag]">,
) {
  const { tag } = await ctx.params;
  const normalized = normalizeHashtag(decodeURIComponent(tag));

  const user = await getCurrentUser();
  const posts = await prisma.post.findMany({
    where: { hashtags: { has: normalized } },
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
    tag: normalized,
    posts: posts.map((p) => toPostDTO(p, likedSet.has(p.id))),
  });
}
