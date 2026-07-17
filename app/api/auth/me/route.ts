import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (user.role === "teacher") {
    return NextResponse.json({
      role: "teacher",
      teacher: { id: user.teacher.id, email: user.teacher.email },
    });
  }
  return NextResponse.json({
    role: "student",
    student: { id: user.student.id, email: user.student.email, displayName: user.student.displayName },
  });
}
