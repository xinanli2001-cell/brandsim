// LLM-as-judge：给一个 (query, post) 组合打相关性分档（0-3）。
// 无 key 时用词重合度启发式打分——确定性、可复现，不是随机数，
// 保证没有 API key 时评测流水线也能产出有意义的（虽然粗糙的）标注。

import OpenAI from "openai";
import { z } from "zod";
import type { Post, Product } from "@prisma/client";

const RelevanceSchema = z.object({ relevance: z.number().int().min(0).max(3) });

export function heuristicRelevance(
  query: string,
  post: { text: string; hashtags: string[] },
  product?: { title: string; category: string } | null,
): number {
  const qTokens = new Set(query.toLowerCase().split(/\s+/).filter(Boolean));
  const docText = [post.text, ...post.hashtags, product?.title ?? "", product?.category ?? ""]
    .join(" ")
    .toLowerCase();
  const docTokens = new Set(docText.split(/\s+/).filter(Boolean));

  let overlap = 0;
  for (const t of qTokens) if (docTokens.has(t)) overlap++;
  const ratio = qTokens.size === 0 ? 0 : overlap / qTokens.size;

  if (ratio === 0) return 0;
  if (ratio < 0.34) return 1;
  if (ratio < 0.67) return 2;
  return 3;
}

export async function judgeRelevance(
  query: string,
  post: Post & { product: Product | null },
): Promise<{ relevance: number; judgedBy: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { relevance: heuristicRelevance(query, post, post.product), judgedBy: "heuristic" };
  }

  try {
    const client = new OpenAI({ baseURL: process.env.OPENAI_BASE_URL });
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a search relevance judge for a content-commerce app. Rate how relevant the given post is to the search query, " +
            "on a scale of 0-3: 0 = not relevant, 1 = weakly relevant, 2 = relevant, 3 = highly relevant. " +
            'Respond as JSON: {"relevance": 0}.',
        },
        {
          role: "user",
          content: `Query: ${query}\n\nPost text: ${post.text}\nHashtags: ${post.hashtags.join(" ")}\nProduct: ${post.product?.title ?? "none"} (${post.product?.category ?? ""})`,
        },
      ],
    });
    const raw = resp.choices[0]?.message?.content ?? "{}";
    const parsed = RelevanceSchema.parse(JSON.parse(raw));
    return { relevance: parsed.relevance, judgedBy: "llm" };
  } catch (err) {
    console.error("[judge] fallback to heuristic:", (err as Error).message);
    return { relevance: heuristicRelevance(query, post, post.product), judgedBy: "heuristic" };
  }
}
