import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentStudent } from "@/lib/auth/session";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/groups/[groupId]/leave">,
) {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
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
