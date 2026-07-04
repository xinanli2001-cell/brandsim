import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentTeacher } from "@/lib/auth/session";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/challenges/[id]">,
) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const challenge = await prisma.challenge.findUnique({
    where: { id },
    include: { groups: { include: { rounds: true } } },
  });
  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  if (challenge.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Not authorized to view this challenge" }, { status: 403 });
  }

  const groups = challenge.groups.map((g) => {
    const rounds = g.rounds.sort((a, b) => a.round - b.round);
    const last = rounds[rounds.length - 1];
    const lastResult = last?.result as
      | { metrics?: { reach?: number; engagement?: number } }
      | undefined;
    return {
      id: g.id,
      groupName: g.groupName,
      tokenBalance: g.tokenBalance,
      currentRound: g.currentRound,
      status: g.status,
      finalScore: g.finalScore,
      latestReach: lastResult?.metrics?.reach ?? null,
      latestEngagement: lastResult?.metrics?.engagement ?? null,
      lastActiveAt: last?.createdAt ?? g.createdAt,
    };
  });

  return NextResponse.json({
    challenge: {
      id: challenge.id,
      status: challenge.status,
      brandName: challenge.brandName,
      brandBackground: challenge.brandBackground,
      goal: challenge.goal,
      targetAudience: challenge.targetAudience,
      seasonalContext: challenge.seasonalContext,
      followerBase: challenge.followerBase,
      totalRounds: challenge.totalRounds,
      startingTokens: challenge.startingTokens,
      difficulty: challenge.difficulty,
      availableActions: challenge.availableActions,
      leaderboardEnabled: challenge.leaderboardEnabled,
      joinCode: challenge.joinCode,
      createdAt: challenge.createdAt,
    },
    groups,
  });
}

const PatchSchema = z.object({
  status: z.enum(["active", "paused", "ended"]),
});

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/challenges/[id]">,
) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed" }, { status: 422 });
  }

  const existing = await prisma.challenge.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  if (existing.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Not authorized to modify this challenge" }, { status: 403 });
  }

  const challenge = await prisma.challenge.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ challenge: { id: challenge.id, status: challenge.status } });
}
