// LLM 重排：给一批候选结果，让 LLM 按和 query 的相关性重新打分排序。
// 无 key、候选为空、或调用失败时原样透传（不改变顺序）。

import OpenAI from "openai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { SearchHit } from "./keyword";

const RerankSchema = z.object({
  scores: z.array(z.object({ postId: z.string(), score: z.number().min(0).max(1) })),
});

export async function rerank(query: string, candidates: SearchHit[]): Promise<SearchHit[]> {
  if (!process.env.OPENAI_API_KEY || candidates.length === 0) return candidates;

  try {
    const posts = await prisma.post.findMany({
      where: { id: { in: candidates.map((c) => c.postId) } },
      include: { product: true },
    });
    const byId = new Map(posts.map((p) => [p.id, p]));

    const listing = candidates
      .map((c) => {
        const p = byId.get(c.postId);
        return `${c.postId}: ${p?.text ?? ""} ${p?.product?.title ?? ""}`;
      })
      .join("\n");

    const client = new OpenAI();
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a search relevance ranker for a content-commerce app. Given a query and a list of candidate posts (id: text), " +
            'score each post\'s relevance to the query from 0 (irrelevant) to 1 (highly relevant). ' +
            'Respond as JSON: {"scores":[{"postId":"...","score":0.0}]}.',
        },
        { role: "user", content: `Query: ${query}\n\nCandidates:\n${listing}` },
      ],
    });

    const raw = resp.choices[0]?.message?.content ?? "{}";
    const parsed = RerankSchema.parse(JSON.parse(raw));
    const scoreById = new Map(parsed.scores.map((s) => [s.postId, s.score]));

    return [...candidates]
      .map((c) => ({ postId: c.postId, score: scoreById.get(c.postId) ?? c.score }))
      .sort((a, b) => b.score - a.score);
  } catch (err) {
    console.error("[rerank] fallback to original order:", (err as Error).message);
    return candidates;
  }
}
