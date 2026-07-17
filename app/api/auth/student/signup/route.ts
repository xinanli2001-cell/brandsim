import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(40),
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
    return NextResponse.json(
      { error: "Please enter a valid email, a password with at least 8 characters, and a display name" },
      { status: 422 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.student.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const student = await prisma.student.create({
    data: { email, passwordHash, displayName: parsed.data.displayName },
  });
  await createSession({ studentId: student.id });

  return NextResponse.json({
    student: { id: student.id, email: student.email, displayName: student.displayName },
  });
}
