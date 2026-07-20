// LLM 层：只产出软性字段（内容质量系数、文字反馈、拟真互动）。
// 无 OPENAI_API_KEY 时自动回退到确定性桩，保证开发/演示随时可跑。

import OpenAI from "openai";
import { z } from "zod";
import type { ActionSelection, Challenge, EvaluationResult, LlmJudgement, Post } from "../types";
import { makeRng, clamp } from "./seed";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// GPT-5 系列与 o 系列推理模型只接受默认 temperature（传 0.7 会直接报错→静默退回 stub）。
// 这类模型不传 temperature，其余模型保持 0.7 以维持反馈多样性。
function supportsCustomTemperature(model: string): boolean {
  return !/^(gpt-5|o\d)/i.test(model);
}

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

function normalizedWords(values: string[]): string[] {
  return values.map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, "")).filter(Boolean);
}

function targetMatches(post: Post, challenge?: Challenge): number {
  if (!challenge) return 0;
  const textWords = normalizedWords([post.text, ...post.hashtags]);
  const targets = normalizedWords([
    ...challenge.targetAudience.coreDemographics,
    ...challenge.targetAudience.coreInterests,
  ]);
  return targets.filter((target) => textWords.some((word) => word.includes(target) || target.includes(word))).length;
}

function timingScore(post: Post): number {
  const schoolWeek = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(post.scheduledDay);
  const daytime = post.scheduledHour >= 8 && post.scheduledHour <= 20;
  if (schoolWeek && daytime) return 1;
  if (daytime) return 0.5;
  return -0.5;
}

function actionFocus(actions?: ActionSelection): number {
  if (!actions) return 0;
  let score = 0;
  if (actions.audience && actions.audience.demographics.length + actions.audience.interests.length > 0) score += 0.08;
  if (actions.boost && actions.boost.level > 0) score += 0.03;
  if (actions.influencer) score += 0.04;
  if (actions.ad && !actions.audience && actions.ad.spend >= 30) score -= 0.05;
  return score;
}

function previousPerformanceNote(previousResult?: EvaluationResult | null): string | null {
  if (!previousResult) return null;
  const ctr = previousResult.metrics.ctr;
  if (ctr < 0.03) return "Previous round had soft click-through, so the CTA and audience fit matter more here";
  if (previousResult.metrics.engagement > 120) return "Previous round had solid engagement, so this round should preserve the hook while sharpening conversion";
  return "Previous round gives a baseline for improving clarity and timing";
}

// 确定性桩：无 key 或调用失败时使用，仍然可复现
export function stubJudgement(
  post: Post,
  challenge?: Challenge,
  actions?: ActionSelection,
  previousResult?: EvaluationResult | null,
): LlmJudgement {
  const rng = makeRng(post.id + "-llm", post.round);
  const hasCta = /(click|learn more|shop|buy|follow|link|visit|sign up|join|explore|tap)/i.test(post.text);
  const lenOk = post.text.length >= 20 && post.text.length <= 240;
  const audienceHits = targetMatches(post, challenge);
  const hashtagHits = targetMatches({ ...post, text: "", hashtags: post.hashtags }, challenge);
  const timing = timingScore(post);
  const brandSeasonTerms = normalizedWords([
    challenge?.brandName ?? "",
    challenge?.seasonalContext ?? "",
    challenge?.brandBackground ?? "",
  ]);
  const postTerms = normalizedWords([post.text]);
  const brandSeasonHit = brandSeasonTerms.some((term) =>
    postTerms.some((word) => word.includes(term) || term.includes(word)),
  );
  const difficultyDrag = challenge?.difficulty === "hard" ? -0.03 : challenge?.difficulty === "easy" ? 0.02 : 0;
  const base =
    0.98 +
    (hasCta ? 0.1 : -0.08) +
    (lenOk ? 0.05 : -0.07) +
    Math.min(0.12, audienceHits * 0.04) +
    Math.min(0.08, hashtagHits * 0.04) +
    timing * 0.05 +
    (post.hasImage ? 0.03 : -0.04) +
    (brandSeasonHit ? 0.04 : -0.02) +
    actionFocus(actions) +
    difficultyDrag;
  const q = clamp(base + (rng() - 0.5) * 0.1, 0.7, 1.3);
  const previousNote = previousPerformanceNote(previousResult);

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
    contentNotes: [
      audienceHits > 0 ? "Audience targeting is reflected in the post" : "Audience fit is too generic",
      hasCta ? "CTA is clear enough to support clicks" : "Missing a clear CTA",
      timing > 0 && brandSeasonHit ? "Timing, brand tone, and seasonal context are aligned" : "Timing or brand-season fit could be sharper",
      lenOk ? "Copy length is easy to scan" : "Copy length could be improved",
    ],
    feedback: [
      hasCta
        ? "The post gives students a clear next step and keeps the message focused."
        : "The direction is understandable, but a more explicit CTA would make clicks easier to earn.",
      audienceHits > 0
        ? "It connects to the target audience instead of speaking to everyone at once."
        : "Tie the copy more directly to the target audience's needs and interests.",
      previousNote ? `Compared with the previous round: ${previousNote.toLowerCase()}.` : null,
    ]
      .filter(Boolean)
      .join(" "),
    visibleEngagement,
  };
}

export async function judgeWithLlm(
  post: Post,
  challenge: Challenge,
  actionsSummary: string,
  previousSummary: string,
  actions?: ActionSelection,
  previousResult?: EvaluationResult | null,
): Promise<LlmJudgement> {
  if (!process.env.OPENAI_API_KEY) return stubJudgement(post, challenge, actions, previousResult);

  try {
    const client = new OpenAI();
    const sys =
      "You are a social media marketing evaluation assistant. Only evaluate the copy's content quality and generate realistic audience engagement. " +
      "Respond strictly as JSON — do not invent numeric metrics (impressions/reach etc. are computed by external rules). " +
      "Internally reason through these dimensions before choosing the final coefficient: audience fit, copy clarity, CTA strength, hashtag strategy, posting timing, brand tone, seasonal fit, creativity, and whether the paid actions support the message. " +
      "Do not output dimension scores or any hidden rubric. qualityCoefficient reflects the combined content quality only, range 0.7-1.3. " +
      "visibleEngagement should have 7-11 entries, using natural-sounding real names — never labels like 'User1'. " +
      "Respond in English.";
    const user = [
      `Brand: ${challenge.brandName} — ${challenge.brandBackground}`,
      `Goal: ${challenge.goal}`,
      `Difficulty: ${challenge.difficulty}`,
      `Target audience: ${challenge.targetAudience.coreDemographics.join(", ")} / ${challenge.targetAudience.coreInterests.join(", ")}`,
      `Seasonal context: ${challenge.seasonalContext}`,
      `This round's actions: ${actionsSummary}`,
      `Previous round performance: ${previousSummary}`,
      `Student's post text: """${post.text}"""`,
      `Hashtags: ${post.hashtags.join(" ")}`,
      `Image: ${post.hasImage ? post.imageStyle || "yes" : "none"}`,
      `Scheduled timing: ${post.scheduledDay} at ${post.scheduledHour}:00`,
    ].join("\n");

    const resp = await client.chat.completions.create({
      model: MODEL,
      ...(supportsCustomTemperature(MODEL) ? { temperature: 0.7 } : {}),
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
    return stubJudgement(post, challenge, actions, previousResult);
  }
}
