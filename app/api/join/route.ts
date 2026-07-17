import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizeJoinCode } from "@/lib/join-code";
import { uniqueGroupName } from "@/lib/data/group";
import { getCurrentStudent } from "@/lib/auth/session";
import { toChallenge, toGameState } from "@/lib/game-state";

const BodySchema = z.object({
  joinCode: z.string().min(1),
});

export async function POST(request: Request) {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
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
    const groupName = await uniqueGroupName(challengeRow.id, student.displayName);
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
  }

  return NextResponse.json({
    groupId: group.id,
    challenge: toChallenge(challengeRow),
    gameState: toGameState(group, group.rounds, challengeRow.totalRounds),
  });
}
