import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { assertStudent, AuthError } from "@/lib/auth/guards";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/groups/[groupId]/leave">,
) {
  let student;
  try {
    student = assertStudent(await getCurrentUser());
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { groupId } = await ctx.params;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  if (group.studentId !== student.id) {
    return NextResponse.json({ error: "Not authorized to leave this group" }, { status: 403 });
  }

  await prisma.group.update({ where: { id: groupId }, data: { leftAt: new Date() } });

  return NextResponse.json({ ok: true });
}
