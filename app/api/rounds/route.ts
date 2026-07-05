// 核心闭环端点：学生提交本轮帖子+动作 -> 校验代币/轮次 -> 评估引擎 -> 落库 -> 结算。
// 落库那一段包在事务里、用乐观并发检查兜底，防止同一轮次的并发提交产生竞态。

import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toChallenge, toGameState } from "@/lib/game-state";
import { evaluate, computeFinalScore } from "@/lib/engine/evaluate";
import { checkContent } from "@/lib/moderation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertUser, AuthError } from "@/lib/auth/guards";
import { normalizeHashtag } from "@/lib/hashtag";
import { buildSearchText } from "@/lib/search/searchText";
import type { EvaluationRequest, EvaluationResult } from "@/lib/types";

const DaySchema = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

const BodySchema = z.object({
  groupId: z.string(),
  post: z.object({
    id: z.string(),
    text: z.string().min(1),
    hashtags: z.array(z.string()).max(10),
    hasImage: z.boolean(),
    imageStyle: z.string().optional(),
    scheduledDay: DaySchema,
    scheduledHour: z.number().min(0).max(23),
  }),
  actions: z.object({
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
    totalCost: z.number().min(0),
  }),
});

class RoundConflictError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }
  const { groupId, post: postInput, actions: actionsInput } = parsed.data;

  const moderation = checkContent([postInput.text, ...postInput.hashtags].join(" "));
  if (!moderation.allowed) {
    return NextResponse.json({ error: moderation.reason }, { status: 422 });
  }

  // 快速失败预检：不进事务，避免让白跑的 LLM 调用挡住其他请求。
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { rounds: true },
  });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  if (group.status === "finished") {
    return NextResponse.json({ error: "This session has already finished" }, { status: 409 });
  }
  const challengeRow = await prisma.challenge.findUnique({
    where: { id: group.challengeId },
  });
  if (!challengeRow) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  if (challengeRow.status === "paused") {
    return NextResponse.json({ error: "The teacher has paused this challenge" }, { status: 409 });
  }
  if (challengeRow.status === "ended") {
    return NextResponse.json({ error: "This challenge has ended" }, { status: 409 });
  }

  const round = group.currentRound;
  const already = group.rounds.find((r) => r.round === round);
  if (already) {
    return NextResponse.json({ error: "This round has already been submitted" }, { status: 409 });
  }
  if (actionsInput.totalCost > group.tokenBalance) {
    return NextResponse.json({ error: "Not enough tokens" }, { status: 402 });
  }

  const challenge = toChallenge(challengeRow);
  const post = { ...postInput, challengeId: challenge.id, round };
  const actions = { ...actionsInput, round };

  const previousRow = group.rounds.find((r) => r.round === round - 1);
  const previousResult = previousRow
    ? (previousRow.result as unknown as EvaluationResult)
    : null;

  const evalReq: EvaluationRequest = {
    challenge,
    post,
    actions,
    previousResult: previousResult ?? null,
    round,
  };

  // 这一步可能调用真实 LLM、耗时不定，故意放在事务外面。
  const result = await evaluate(evalReq);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // 事务内重新读取最新状态，关闭"预检之后、落库之前"这段时间窗口的竞态。
      const freshGroup = await tx.group.findUniqueOrThrow({
        where: { id: groupId },
        include: { rounds: true },
      });

      if (freshGroup.status === "finished") {
        throw new RoundConflictError("This session has already finished", 409);
      }
      if (freshGroup.currentRound !== round) {
        throw new RoundConflictError("This round has already been submitted", 409);
      }
      if (actionsInput.totalCost > freshGroup.tokenBalance) {
        throw new RoundConflictError("Not enough tokens", 402);
      }

      try {
        await tx.round.create({
          data: {
            groupId,
            round,
            post,
            actions,
            result: result as unknown as object,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new RoundConflictError("This round has already been submitted", 409);
        }
        throw err;
      }

      const createdRound = await tx.round.findUniqueOrThrow({
        where: { groupId_round: { groupId, round } },
      });

      const roundHashtags = postInput.hashtags.map(normalizeHashtag);
      const roundSearchText = buildSearchText({ text: postInput.text, hashtags: roundHashtags });

      await tx.post.upsert({
        where: { roundId: createdRound.id },
        create: {
          authorId: user.id,
          text: postInput.text,
          searchText: roundSearchText,
          hashtags: roundHashtags,
          source: "round",
          roundId: createdRound.id,
        },
        update: {
          text: postInput.text,
          searchText: roundSearchText,
          hashtags: roundHashtags,
        },
      });

      const isLastRound = round >= challenge.totalRounds;
      const priorResults: EvaluationResult[] = freshGroup.rounds
        .sort((a, b) => a.round - b.round)
        .map((r) => r.result as unknown as EvaluationResult);
      const allResults = [...priorResults, result];

      return tx.group.update({
        where: { id: groupId },
        data: {
          tokenBalance: { decrement: actionsInput.totalCost },
          currentRound: isLastRound ? freshGroup.currentRound : freshGroup.currentRound + 1,
          status: isLastRound ? "finished" : "in_progress",
          finalScore: isLastRound
            ? computeFinalScore(allResults.map((r) => ({ result: r })))
            : undefined,
        },
        include: { rounds: true },
      });
    });

    return NextResponse.json({
      result,
      gameState: toGameState(updated, updated.rounds, challenge.totalRounds),
    });
  } catch (err) {
    if (err instanceof RoundConflictError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[rounds] transaction failed:", err);
    return NextResponse.json({ error: "Failed to save round" }, { status: 500 });
  }
}
