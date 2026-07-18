import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { toPostDTO, computeLikedSet } from "@/lib/posts";
import { searchKeyword } from "@/lib/search/keyword";
import { searchSemantic } from "@/lib/search/semantic";
import { rerank } from "@/lib/search/rerank";
import { classifyIntent } from "@/lib/search/query-understanding";
import type { SearchHit } from "@/lib/search/keyword";

const STRATEGIES = ["keyword", "semantic", "llm_rerank"] as const;
type Strategy = (typeof STRATEGIES)[number];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const strategyParam = searchParams.get("strategy") ?? "keyword";
  const limit = Math.min(Number(searchParams.get("limit") ?? 10) || 10, 50);

  if (!q) {
    return NextResponse.json({ error: "missing query param 'q'" }, { status: 422 });
  }
  if (!STRATEGIES.includes(strategyParam as Strategy)) {
    return NextResponse.json(
      { error: `strategy must be one of ${STRATEGIES.join(", ")}` },
      { status: 422 },
    );
  }
  const strategy = strategyParam as Strategy;

  let hits: SearchHit[];
  if (strategy === "keyword") {
    hits = await searchKeyword(q, limit);
  } else if (strategy === "semantic") {
    hits = await searchSemantic(q, limit);
  } else {
    const candidates = await searchKeyword(q, Math.max(limit * 2, 20));
    hits = (await rerank(q, candidates)).slice(0, limit);
  }

  const intent = await classifyIntent(q);

  const posts = await prisma.post.findMany({
    where: { id: { in: hits.map((h) => h.postId) } },
    include: { author: true, product: true },
  });
  const byId = new Map(posts.map((p) => [p.id, p]));
  const user = await getCurrentUser();
  const likedSet = await computeLikedSet(
    prisma,
    user?.id ?? null,
    hits.map((h) => h.postId),
  );

  const results = hits
    .map((h) => {
      const post = byId.get(h.postId);
      if (!post) return null;
      return { post: toPostDTO(post, likedSet.has(post.id)), score: h.score };
    })
    .filter((r): r is { post: ReturnType<typeof toPostDTO>; score: number } => r !== null);

  return NextResponse.json({ query: q, strategy, intent, results });
}
