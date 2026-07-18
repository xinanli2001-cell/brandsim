import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertTeacher, AuthError } from "@/lib/auth/guards";
import { toTokenEconomy } from "@/lib/teacher/insights";

export async function GET() {
  let teacher;
  try {
    teacher = assertTeacher(await getCurrentUser());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const challenges = await prisma.challenge.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    include: { groups: { include: { student: true, rounds: true } } },
  });

  return NextResponse.json(toTokenEconomy(challenges));
}
