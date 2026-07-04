// 把 Prisma 的 Challenge + Group + Round[] 组装成契约里的 GameState / Challenge 形状。

import type { Group, Round, Challenge as ChallengeRow } from "@prisma/client";
import type { Challenge, EvaluationResult, GameState } from "./types";

export function toChallenge(row: ChallengeRow): Challenge {
  return {
    id: row.id,
    brandName: row.brandName,
    brandBackground: row.brandBackground,
    goal: row.goal,
    targetAudience: row.targetAudience as Challenge["targetAudience"],
    seasonalContext: row.seasonalContext,
    followerBase: row.followerBase,
    totalRounds: row.totalRounds,
    startingTokens: row.startingTokens,
    difficulty: row.difficulty as Challenge["difficulty"],
    availableActions: row.availableActions as Challenge["availableActions"],
    leaderboardEnabled: row.leaderboardEnabled,
  };
}

export function toGameState(
  group: Group,
  rounds: Round[],
  totalRounds: number,
): GameState {
  return {
    challengeId: group.challengeId,
    currentRound: group.currentRound,
    totalRounds,
    tokenBalance: group.tokenBalance,
    history: rounds
      .sort((a, b) => a.round - b.round)
      .map((r) => ({
        round: r.round,
        post: r.post as unknown as GameState["history"][number]["post"],
        actions: r.actions as unknown as GameState["history"][number]["actions"],
        result: r.result as unknown as EvaluationResult,
      })),
    status: group.status as GameState["status"],
  };
}
