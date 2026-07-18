import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertStudent, AuthError } from "@/lib/auth/guards";

export async function GET() {
  let student;
  try {
    student = assertStudent(await getCurrentUser());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
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
