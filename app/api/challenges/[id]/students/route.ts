import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertTeacher, AuthError } from "@/lib/auth/guards";
import { toStudentProgress } from "@/lib/teacher/insights";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/challenges/[id]/students">,
) {
  let teacher;
  try {
    teacher = assertTeacher(await getCurrentUser());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
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
