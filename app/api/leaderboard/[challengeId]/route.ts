// 真实排行榜：按参与小组的当前最佳表现排名（finished 用 finalScore，进行中用当前最高互动近似）。

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { LeaderboardEntry } from "@/lib/types";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/leaderboard/[challengeId]">,
) {
  const { challengeId } = await ctx.params;
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
