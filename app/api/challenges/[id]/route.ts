import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertTeacher, AuthError } from "@/lib/auth/guards";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/challenges/[id]">,
) {
  let teacher;
  try {
    teacher = assertTeacher(await getCurrentUser());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
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
      archivedAt: challenge.archivedAt,
      groupCount: challenge.groups.length,
      createdAt: challenge.createdAt,
    },
    groups,
  });
}

const PatchSchema = z
  .object({
    status: z.enum(["active", "paused", "ended"]).optional(),
    archived: z.boolean().optional(),
  })
  .refine((d) => d.status !== undefined || d.archived !== undefined, {
    message: "must provide status or archived",
  });

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/challenges/[id]">,
) {
  let teacher;
  try {
    teacher = assertTeacher(await getCurrentUser());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
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

  const data: { status?: string; archivedAt?: Date | null } = {};
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.archived !== undefined) data.archivedAt = parsed.data.archived ? new Date() : null;

  const challenge = await prisma.challenge.update({ where: { id }, data });

  return NextResponse.json({
    challenge: { id: challenge.id, status: challenge.status, archivedAt: challenge.archivedAt },
  });
}

const EditSchema = z.object({
  brandName: z.string().min(1),
  brandBackground: z.string().min(1),
  goal: z.string().min(1),
  targetAudience: z.object({
    coreDemographics: z.array(z.string()),
    coreInterests: z.array(z.string()),
  }),
  seasonalContext: z.string(),
  followerBase: z.number().int().positive(),
  totalRounds: z.number().int().min(1).max(10),
  startingTokens: z.number().int().min(0),
  difficulty: z.enum(["easy", "normal", "hard"]),
  availableActions: z.array(z.enum(["boost", "ad", "audience", "influencer"])),
  leaderboardEnabled: z.boolean(),
});

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/challenges/[id]">,
) {
  let teacher;
  try {
    teacher = assertTeacher(await getCurrentUser());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = EditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const existing = await prisma.challenge.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  if (existing.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Not authorized to modify this challenge" }, { status: 403 });
  }

  // 有学生加入过（groups 非空）时，回合数/初始代币/难度/可用动作/排行榜开关锁死，
  // 不管客户端传了什么都保留原值——服务端强制，不信任前端的禁用状态。
  // group 数量在事务内重新统计，关闭"预检之后、落库之前"这段时间窗口的竞态
  // （比如老师刚点保存的瞬间正好有学生加入）。
  const challenge = await prisma.$transaction(async (tx) => {
    const groupCount = await tx.group.count({ where: { challengeId: id } });
    const hasStudents = groupCount > 0;
    const data = hasStudents
      ? {
          brandName: parsed.data.brandName,
          brandBackground: parsed.data.brandBackground,
          goal: parsed.data.goal,
          targetAudience: parsed.data.targetAudience,
          seasonalContext: parsed.data.seasonalContext,
          followerBase: parsed.data.followerBase,
        }
      : parsed.data;
    return tx.challenge.update({ where: { id }, data });
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
      archivedAt: challenge.archivedAt,
    },
  });
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/challenges/[id]">,
) {
  let teacher;
  try {
    teacher = assertTeacher(await getCurrentUser());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await ctx.params;
  const existing = await prisma.challenge.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  if (existing.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Not authorized to delete this challenge" }, { status: 403 });
  }

  // Challenge -> Group -> Round 的 onDelete: Cascade 已经在 schema 里，
  // 这一次 delete 会把该挑战下所有小组和回合记录一起删掉。
  await prisma.challenge.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
