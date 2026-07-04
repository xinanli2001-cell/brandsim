import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluate } from "@/lib/engine/evaluate";
import type { EvaluationRequest } from "@/lib/types";

const DaySchema = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

const RequestSchema = z.object({
  challenge: z.object({
    id: z.string(),
    brandName: z.string(),
    brandBackground: z.string(),
    goal: z.string(),
    targetAudience: z.object({
      coreDemographics: z.array(z.string()),
      coreInterests: z.array(z.string()),
    }),
    seasonalContext: z.string(),
    followerBase: z.number(),
    totalRounds: z.number(),
    startingTokens: z.number(),
    difficulty: z.enum(["easy", "normal", "hard"]),
    availableActions: z.array(z.enum(["boost", "ad", "audience", "influencer"])),
    leaderboardEnabled: z.boolean(),
  }),
  post: z.object({
    id: z.string(),
    challengeId: z.string(),
    round: z.number(),
    text: z.string(),
    hashtags: z.array(z.string()),
    hasImage: z.boolean(),
    imageStyle: z.string().optional(),
    scheduledDay: DaySchema,
    scheduledHour: z.number().min(0).max(23),
  }),
  actions: z.object({
    round: z.number(),
    boost: z.object({ level: z.number(), cost: z.number() }).optional(),
    ad: z.object({ spend: z.number(), cost: z.number() }).optional(),
    audience: z
      .object({
        demographics: z.array(z.string()),
        interests: z.array(z.string()),
        cost: z.number(),
      })
      .optional(),
    influencer: z.object({ id: z.string(), cost: z.number() }).optional(),
    totalCost: z.number(),
  }),
  previousResult: z.any().optional().nullable(),
  round: z.number(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  try {
    const result = await evaluate(parsed.data as EvaluationRequest);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[evaluate] error:", err);
    return NextResponse.json({ error: "evaluation failed" }, { status: 500 });
  }
}
