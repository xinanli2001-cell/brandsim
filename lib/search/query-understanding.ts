// Query 理解：意图分类（导航/交易/宽泛）+ query 扩展词建议。
// 无 key 时用关键词规则做确定性兜底分类（不是随机），expandedTerms 留空。

import OpenAI from "openai";
import { z } from "zod";

export interface QueryUnderstanding {
  intent: "navigational" | "transactional" | "broad";
  expandedTerms: string[];
}

const ResultSchema = z.object({
  intent: z.enum(["navigational", "transactional", "broad"]),
  expandedTerms: z.array(z.string()).max(5),
});

export function stubClassify(query: string): QueryUnderstanding {
  const q = query.toLowerCase().trim();
  const transactionalWords = ["buy", "price", "cheap", "discount", "shop", "order", "deal"];
  const isTransactional = transactionalWords.some((w) => q.includes(w));
  const wordCount = q.split(/\s+/).filter(Boolean).length;
  const isNavigational = wordCount <= 2 && !isTransactional;

  return {
    intent: isTransactional ? "transactional" : isNavigational ? "navigational" : "broad",
    expandedTerms: [],
  };
}

export async function classifyIntent(query: string): Promise<QueryUnderstanding> {
  if (!process.env.OPENAI_API_KEY) return stubClassify(query);

  try {
    const client = new OpenAI();
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Classify the e-commerce search query\'s intent as "navigational" (looking for a specific known item/brand), ' +
            '"transactional" (ready to buy, price-sensitive), or "broad" (exploring a category). ' +
            'Also suggest up to 5 expanded search terms (synonyms/related terms). ' +
            'Respond as JSON: {"intent":"...","expandedTerms":["..."]}.',
        },
        { role: "user", content: query },
      ],
    });
    const raw = resp.choices[0]?.message?.content ?? "{}";
    return ResultSchema.parse(JSON.parse(raw));
  } catch (err) {
    console.error("[query-understanding] fallback to stub:", (err as Error).message);
    return stubClassify(query);
  }
}
