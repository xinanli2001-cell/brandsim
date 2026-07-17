// 真实排行榜：按参与小组的当前最佳表现排名（finished 用 finalScore，进行中用当前最高互动近似）。
// 仅挑战参与者（学生）或该挑战的老师可读；学生端还需老师开启了排行榜功能。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import type { LeaderboardEntry } from "@/lib/types";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/leaderboard/[challengeId]">,
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { challengeId } = await ctx.params;
  const challengeRow = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challengeRow) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  if (user.role === "teacher") {
    if (challengeRow.teacherId !== user.teacher.id) {
      return NextResponse.json({ error: "Not authorized to view this leaderboard" }, { status: 403 });
    }
  } else {
    if (!challengeRow.leaderboardEnabled) {
      return NextResponse.json(
        { error: "The teacher has disabled the leaderboard for this challenge" },
        { status: 403 },
      );
    }
    const participant = await prisma.group.findFirst({
      where: { challengeId, studentId: user.student.id },
    });
    if (!participant) {
      return NextResponse.json({ error: "Not authorized to view this leaderboard" }, { status: 403 });
    }
  }

  const url = new URL(request.url);
  const viewerGroupId = url.searchParams.get("groupId");

  const groups = await prisma.group.findMany({
    where: { challengeId },
    include: { rounds: true },
  });

  const entries: LeaderboardEntry[] = groups.map((g) => {
    const bestEngagement = Math.max(
      0,
      ...g.rounds.map((r) => (r.result as { metrics?: { engagement?: number } }).metrics?.engagement ?? 0),
    );
    return {
      groupName: g.groupName,
      finalScore: g.finalScore ?? bestEngagement,
      bestMetric: g.status === "finished" ? "Overall Score" : "Current Best Engagement",
      isYou: g.id === viewerGroupId,
    };
  });

  entries.sort((a, b) => b.finalScore - a.finalScore);

  return NextResponse.json({ entries });
}
