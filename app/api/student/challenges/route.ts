import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentStudent } from "@/lib/auth/session";

export async function GET() {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const groups = await prisma.group.findMany({
    where: { studentId: student.id, leftAt: null },
    include: { challenge: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    challenges: groups.map((g) => ({
      groupId: g.id,
      challengeId: g.challengeId,
      brandName: g.challenge.brandName,
      challengeStatus: g.challenge.status,
      groupStatus: g.status,
      currentRound: g.currentRound,
      totalRounds: g.challenge.totalRounds,
      finalScore: g.finalScore,
    })),
  });
}
