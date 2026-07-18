import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeJoinCode } from "@/lib/join-code";
import { uniqueGroupName } from "@/lib/data/group";
import { getCurrentUser } from "@/lib/auth/session";
import { assertStudent, AuthError } from "@/lib/auth/guards";
import { toChallenge, toGameState } from "@/lib/game-state";

const BodySchema = z.object({
  joinCode: z.string().min(1),
});

export async function POST(request: Request) {
  let student;
  try {
    student = assertStudent(await getCurrentUser());
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

  const joinCode = normalizeJoinCode(parsed.data.joinCode);

  const challengeRow = await prisma.challenge.findUnique({ where: { joinCode } });
  if (!challengeRow) {
    return NextResponse.json({ error: "Join code not found" }, { status: 404 });
  }
  if (challengeRow.status === "ended") {
    return NextResponse.json({ error: "This challenge has ended" }, { status: 409 });
  }

  let group = await prisma.group.findUnique({
    where: { challengeId_studentId: { challengeId: challengeRow.id, studentId: student.id } },
    include: { rounds: true },
  });

  if (group) {
    if (group.leftAt) {
      group = await prisma.group.update({
        where: { id: group.id },
        data: { leftAt: null },
        include: { rounds: true },
      });
    }
  } else {
    let groupName = await uniqueGroupName(challengeRow.id, student.displayName ?? student.email);
    for (let attempt = 0; attempt < 3 && !group; attempt++) {
      try {
        group = await prisma.group.create({
          data: {
            challengeId: challengeRow.id,
            studentId: student.id,
            groupName,
            tokenBalance: challengeRow.startingTokens,
            currentRound: 1,
            status: "in_progress",
          },
          include: { rounds: true },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          const target = (err.meta?.target as string[] | undefined) ?? [];
          if (target.includes("studentId")) {
            // 另一个并发请求已经为该学生建好了 group，直接复用
            group = await prisma.group.findUnique({
              where: { challengeId_studentId: { challengeId: challengeRow.id, studentId: student.id } },
              include: { rounds: true },
            });
          } else {
            // groupName 撞车（另一个学生同时用了相同的重名后缀），重新生成后重试
            groupName = await uniqueGroupName(challengeRow.id, student.displayName ?? student.email);
          }
          continue;
        }
        throw err;
      }
    }
    if (!group) {
      return NextResponse.json({ error: "Failed to join, please try again" }, { status: 409 });
    }
  }

  return NextResponse.json({
    groupId: group.id,
    challenge: toChallenge(challengeRow),
    gameState: toGameState(group, group.rounds, challengeRow.totalRounds),
  });
}
