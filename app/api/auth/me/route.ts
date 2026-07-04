import { NextResponse } from "next/server";
import { getCurrentTeacher } from "@/lib/auth/session";

export async function GET() {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  return NextResponse.json({ teacher: { id: teacher.id, email: teacher.email } });
}
