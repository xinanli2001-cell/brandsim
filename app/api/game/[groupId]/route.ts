import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentStudent } from "@/lib/auth/session";
import { toChallenge, toGameState } from "@/lib/game-state";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/game/[groupId]">,
) {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
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
