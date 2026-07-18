import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentTeacher } from "@/lib/auth/session";
import { toTokenEconomy } from "@/lib/teacher/insights";

export async function GET() {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const challenges = await prisma.challenge.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    include: { groups: { include: { student: true, rounds: true } } },
  });

  return NextResponse.json(toTokenEconomy(challenges));
}
