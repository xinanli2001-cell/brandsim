import type { Challenge, Group, Round, User } from "@prisma/client";
import type { ActionKey, EvaluationResult } from "@/lib/types";

const ACTIONS: ActionKey[] = ["boost", "ad", "audience", "influencer"];

type GroupWithStudentRounds = Group & {
  student: User | null;
  rounds: Round[];
  challenge?: Challenge;
};

export type StudentProgressStatus = "not_started" | "in_progress" | "finished";

export interface StudentProgressRow {
  groupId: string;
  studentId: string;
  displayName: string;
  email: string;
  tokenBalance: number;
  completedRounds: number;
  totalRounds: number;
  progressStatus: StudentProgressStatus;
  currentRound: number;
  finalScore: number | null;
  latestReach: number | null;
  latestEngagement: number | null;
  lastActiveAt: Date;
}

export interface ChallengeStudentProgress {
  challenge: {
    id: string;
    brandName: string;
    joinCode: string;
    totalRounds: number;
  };
  students: StudentProgressRow[];
}

export interface TokenEconomySummary {
  totalSpent: number;
  actionTotals: Record<ActionKey, number>;
  actionUses: Record<ActionKey, number>;
  mostUsedAction: { action: ActionKey; uses: number; spent: number } | null;
  byChallenge: Array<{
    challengeId: string;
    brandName: string;
    participantCount: number;
    roundsSubmitted: number;
    totalSpent: number;
    actionTotals: Record<ActionKey, number>;
  }>;
}

export interface ReportsSummary {
  overview: {
    totalChallenges: number;
    participantCount: number;
    completedGroups: number;
    completionRate: number;
    averageReach: number;
    averageEngagement: number;
    averageCtr: number;
  };
  challenges: Array<{
    challengeId: string;
    brandName: string;
    participantCount: number;
    completedGroups: number;
    completedRounds: number;
    totalRounds: number;
    completionRate: number;
    averageReach: number;
    averageEngagement: number;
    averageCtr: number;
    averageFinalScore: number | null;
  }>;
}

function zeroActionTotals(): Record<ActionKey, number> {
  return { boost: 0, ad: 0, audience: 0, influencer: 0 };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function numberFrom(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function actionCost(actions: unknown, action: ActionKey): number {
  const record = asRecord(actions);
  return numberFrom(asRecord(record[action]).cost);
}

function roundResult(round: Round | undefined): EvaluationResult | null {
  return round ? (round.result as unknown as EvaluationResult) : null;
}

function roundMetrics(round: Round | undefined) {
  return roundResult(round)?.metrics ?? null;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function averageRatio(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
}

export function toStudentProgress(challenge: Challenge, groups: GroupWithStudentRounds[]): ChallengeStudentProgress {
  return {
    challenge: {
      id: challenge.id,
      brandName: challenge.brandName,
      joinCode: challenge.joinCode,
      totalRounds: challenge.totalRounds,
    },
    students: groups
      .filter((group) => group.student && group.studentId && group.leftAt === null)
      .map((group) => {
        const sortedRounds = [...group.rounds].sort((a, b) => a.round - b.round);
        const last = sortedRounds.at(-1);
        const metrics = roundMetrics(last);
        const completedRounds = sortedRounds.length;
        const progressStatus: StudentProgressStatus =
          group.status === "finished"
            ? "finished"
            : completedRounds === 0
              ? "not_started"
              : "in_progress";

        return {
          groupId: group.id,
          studentId: group.studentId as string,
          displayName: group.student?.displayName ?? group.groupName,
          email: group.student?.email ?? "",
          tokenBalance: group.tokenBalance,
          completedRounds,
          totalRounds: challenge.totalRounds,
          progressStatus,
          currentRound: group.currentRound,
          finalScore: group.finalScore,
          latestReach: metrics?.reach ?? null,
          latestEngagement: metrics?.engagement ?? null,
          lastActiveAt: last?.createdAt ?? group.createdAt,
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
  };
}

export function toTokenEconomy(challenges: Array<Challenge & { groups: GroupWithStudentRounds[] }>): TokenEconomySummary {
  const actionTotals = zeroActionTotals();
  const actionUses = zeroActionTotals();
  let totalSpent = 0;

  const byChallenge = challenges.map((challenge) => {
    const challengeTotals = zeroActionTotals();
    let challengeSpent = 0;
    let roundsSubmitted = 0;
    const activeGroups = challenge.groups.filter((group) => group.studentId && group.leftAt === null);

    for (const group of activeGroups) {
      for (const round of group.rounds) {
        roundsSubmitted++;
        const actions = asRecord(round.actions);
        const roundTotal = numberFrom(actions.totalCost);
        challengeSpent += roundTotal;
        totalSpent += roundTotal;

        for (const action of ACTIONS) {
          const cost = actionCost(actions, action);
          if (cost > 0) {
            challengeTotals[action] += cost;
            actionTotals[action] += cost;
            actionUses[action] += 1;
          }
        }
      }
    }

    return {
      challengeId: challenge.id,
      brandName: challenge.brandName,
      participantCount: activeGroups.length,
      roundsSubmitted,
      totalSpent: challengeSpent,
      actionTotals: challengeTotals,
    };
  });

  const mostUsedAction = ACTIONS.map((action) => ({
    action,
    uses: actionUses[action],
    spent: actionTotals[action],
  }))
    .filter((row) => row.uses > 0)
    .sort((a, b) => b.uses - a.uses || b.spent - a.spent || ACTIONS.indexOf(a.action) - ACTIONS.indexOf(b.action))[0] ?? null;

  return {
    totalSpent,
    actionTotals,
    actionUses,
    mostUsedAction,
    byChallenge: byChallenge.sort((a, b) => b.totalSpent - a.totalSpent || a.brandName.localeCompare(b.brandName)),
  };
}

export function toReports(challenges: Array<Challenge & { groups: GroupWithStudentRounds[] }>): ReportsSummary {
  const challengeRows = challenges.map((challenge) => {
    const activeGroups = challenge.groups.filter((group) => group.studentId && group.leftAt === null);
    const rounds = activeGroups.flatMap((group) => group.rounds);
    const metrics = rounds.map((round) => roundMetrics(round)).filter((m): m is EvaluationResult["metrics"] => m !== null);
    const finalScores = activeGroups
      .map((group) => group.finalScore)
      .filter((score): score is number => typeof score === "number");
    const completedGroups = activeGroups.filter((group) => group.status === "finished").length;
    const totalRoundSlots = activeGroups.length * challenge.totalRounds;
    const completionRate = totalRoundSlots === 0 ? 0 : Number((rounds.length / totalRoundSlots).toFixed(2));

    return {
      challengeId: challenge.id,
      brandName: challenge.brandName,
      participantCount: activeGroups.length,
      completedGroups,
      completedRounds: rounds.length,
      totalRounds: challenge.totalRounds,
      completionRate,
      averageReach: average(metrics.map((m) => m.reach)),
      averageEngagement: average(metrics.map((m) => m.engagement)),
      averageCtr: averageRatio(metrics.map((m) => m.ctr)),
      averageFinalScore: finalScores.length ? average(finalScores) : null,
    };
  });

  const activeRows = challengeRows.filter((row) => row.participantCount > 0 || row.completedRounds > 0);
  const participantCount = challengeRows.reduce((sum, row) => sum + row.participantCount, 0);
  const completedGroups = challengeRows.reduce((sum, row) => sum + row.completedGroups, 0);

  return {
    overview: {
      totalChallenges: challenges.length,
      participantCount,
      completedGroups,
      completionRate: participantCount === 0 ? 0 : Number((completedGroups / participantCount).toFixed(2)),
      averageReach: average(activeRows.map((row) => row.averageReach).filter((value) => value > 0)),
      averageEngagement: average(activeRows.map((row) => row.averageEngagement).filter((value) => value > 0)),
      averageCtr: averageRatio(activeRows.map((row) => row.averageCtr).filter((value) => value > 0)),
    },
    challenges: challengeRows.sort((a, b) => b.completedRounds - a.completedRounds || a.brandName.localeCompare(b.brandName)),
  };
}
