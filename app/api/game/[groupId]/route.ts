import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertStudent, AuthError } from "@/lib/auth/guards";
import { toChallenge, toGameState } from "@/lib/game-state";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/game/[groupId]">,
) {
  let student;
  try {
    student = assertStudent(await getCurrentUser());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { groupId } = await ctx.params;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { rounds: true },
  });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  if (group.studentId !== student.id) {
    return NextResponse.json({ error: "Not authorized to view this group" }, { status: 403 });
  }

  const challengeRow = await prisma.challenge.findUnique({
    where: { id: group.challengeId },
  });
  if (!challengeRow) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  return NextResponse.json({
    groupId: group.id,
    groupName: group.groupName,
    challenge: toChallenge(challengeRow),
    gameState: toGameState(group, group.rounds, challengeRow.totalRounds),
  });
}
