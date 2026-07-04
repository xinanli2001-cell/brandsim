import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizeJoinCode } from "@/lib/join-code";
import { toChallenge, toGameState } from "@/lib/game-state";

const BodySchema = z.object({
  joinCode: z.string().min(1),
  groupName: z.string().min(1).max(40),
});

export async function POST(request: Request) {
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
  const groupName = parsed.data.groupName.trim();

  const challengeRow = await prisma.challenge.findUnique({ where: { joinCode } });
  if (!challengeRow) {
    return NextResponse.json({ error: "Join code not found" }, { status: 404 });
  }
  if (challengeRow.status === "ended") {
    return NextResponse.json({ error: "This challenge has ended" }, { status: 409 });
  }

  let group = await prisma.group.findUnique({
    where: { challengeId_groupName: { challengeId: challengeRow.id, groupName } },
    include: { rounds: true },
  });

  if (!group) {
    group = await prisma.group.create({
      data: {
        challengeId: challengeRow.id,
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
