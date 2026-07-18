import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentTeacher } from "@/lib/auth/session";
import { toStudentProgress } from "@/lib/teacher/insights";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/challenges/[id]/students">,
) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const challenge = await prisma.challenge.findUnique({
    where: { id },
    include: { groups: { include: { student: true, rounds: true } } },
  });
  if (!challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  if (challenge.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Not authorized to view this challenge" }, { status: 403 });
  }

  return NextResponse.json(toStudentProgress(challenge, challenge.groups));
}
