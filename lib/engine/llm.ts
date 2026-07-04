// LLM 层：只产出软性字段（内容质量系数、文字反馈、拟真互动）。
// 无 OPENAI_API_KEY 时自动回退到确定性桩，保证开发/演示随时可跑。

import OpenAI from "openai";
import { z } from "zod";
import type { Challenge, LlmJudgement, Post } from "../types";
import { makeRng, clamp } from "./seed";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const JudgementSchema = z.object({
  qualityCoefficient: z.number().min(0.7).max(1.3),
  contentNotes: z.array(z.string()).max(4),
  feedback: z.string(),
  visibleEngagement: z
    .array(
      z.object({
        user: z.string(),
        type: z.enum(["comment", "like", "emoji"]),
        text: z.string().optional(),
        likes: z.number().optional(),
      }),
    )
    .max(11),
});

const NAMES = [
  "Sophie Nguyen", "Marcus Reid", "Aisha Khan", "Liam O'Brien", "Chloe Martin",
  "Diego Alvarez", "Hannah Weber", "Yuki Tanaka", "Priya Sharma", "Noah Bennett",
  "Emma Larsson",
];

// 确定性桩：无 key 或调用失败时使用，仍然可复现
export function stubJudgement(post: Post): LlmJudgement {
  const rng = makeRng(post.id + "-llm", post.round);
  const hasCta = /(click|learn more|shop|buy|follow|link)/i.test(post.text);
  const lenOk = post.text.length >= 20 && post.text.length <= 240;
  const base = 1.0 + (hasCta ? 0.12 : -0.05) + (lenOk ? 0.06 : -0.08);
  const q = clamp(base + (rng() - 0.5) * 0.1, 0.7, 1.3);

  const count = 7 + Math.floor(rng() * 4);
  const visibleEngagement = Array.from({ length: count }, (_, i) => {
    const roll = rng();
    const user = NAMES[(i + Math.floor(rng() * NAMES.length)) % NAMES.length];
    if (roll < 0.5)
      return {
        user,
        type: "comment" as const,
        text: ["This color is so soothing 🌿", "I really want one!", "Eco-friendly and cute, love it", "Link please?", "The quality looks great"][
          Math.floor(rng() * 5)
        ],
        likes: Math.floor(rng() * 6),
      };
    if (roll < 0.8) return { user, type: "like" as const };
    return { user, type: "emoji" as const, text: ["😍", "🔥", "👏", "🌿"][Math.floor(rng() * 4)] };
  });

  return {
    qualityCoefficient: Number(q.toFixed(2)),
    contentNotes: [hasCta ? "Has a clear call to action" : "Missing a clear CTA", lenOk ? "Good length" : "Length could be improved"],
    feedback: hasCta
      ? "Good hook and CTA — next round, try more precise audience targeting or adjusting the posting time."
      : "Solid content direction, but it's missing a clear call to action (CTA). Adding one should noticeably lift clicks.",
    visibleEngagement,
  };
}

export async function judgeWithLlm(
  post: Post,
  challenge: Challenge,
  actionsSummary: string,
  previousSummary: string,
): Promise<LlmJudgement> {
  if (!process.env.OPENAI_API_KEY) return stubJudgement(post);

  try {
    const client = new OpenAI();
    const sys =
      "You are a social media marketing evaluation assistant. Only evaluate the copy's content quality and generate realistic audience engagement. " +
      "Respond strictly as JSON — do not invent numeric metrics (impressions/reach etc. are computed by external rules). " +
      "qualityCoefficient reflects copy quality only, range 0.7-1.3. " +
      "visibleEngagement should have 7-11 entries, using natural-sounding real names — never labels like 'User1'. " +
      "Respond in English.";
    const user = [
      `Brand: ${challenge.brandName} — ${challenge.brandBackground}`,
      `Goal: ${challenge.goal}`,
      `Target audience: ${challenge.targetAudience.coreDemographics.join(", ")} / ${challenge.targetAudience.coreInterests.join(", ")}`,
      `Seasonal context: ${challenge.seasonalContext}`,
      `This round's actions: ${actionsSummary}`,
      `Previous round performance: ${previousSummary}`,
      `Student's post text: """${post.text}"""`,
      `Hashtags: ${post.hashtags.join(" ")}`,
      `Image: ${post.hasImage ? post.imageStyle || "yes" : "none"}`,
    ].join("\n");

    const resp = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys + "\nReturn a single JSON object with fields: qualityCoefficient, contentNotes[], feedback, visibleEngagement[]." },
        { role: "user", content: user },
      ],
    });
    const raw = resp.choices[0]?.message?.content ?? "{}";
    const parsed = JudgementSchema.parse(JSON.parse(raw));
    return parsed;
  } catch (err) {
    console.error("[llm] fallback to stub:", (err as Error).message);
    return stubJudgement(post);
  }
}
