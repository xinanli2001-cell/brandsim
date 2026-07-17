import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

const BodySchema = z.object({
  role: z.enum(["teacher", "student"]),
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter your email and password" }, { status: 422 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const genericError = NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });

  if (parsed.data.role === "teacher") {
    const teacher = await prisma.teacher.findUnique({ where: { email } });
    if (!teacher) return genericError;
    const valid = await bcrypt.compare(parsed.data.password, teacher.passwordHash);
    if (!valid) return genericError;
    await createSession({ teacherId: teacher.id });
    return NextResponse.json({ role: "teacher", teacher: { id: teacher.id, email: teacher.email } });
  }

  const student = await prisma.student.findUnique({ where: { email } });
  if (!student) return genericError;
  const valid = await bcrypt.compare(parsed.data.password, student.passwordHash);
  if (!valid) return genericError;
  await createSession({ studentId: student.id });
  return NextResponse.json({
    role: "student",
    student: { id: student.id, email: student.email, displayName: student.displayName },
  });
}
