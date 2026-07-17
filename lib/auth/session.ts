// 教师/学生共用同一套 httpOnly cookie 会话：一行 Session 的 teacherId/studentId 二选一，
// 由调用方在创建时指定，取用时按角色分别读。登出即删行；服务端返回的用户始终是权限判断依据。

import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import type { Teacher, Student } from "@prisma/client";

const COOKIE_NAME = "brandsim_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type SessionOwner = { teacherId: string } | { studentId: string };

export async function createSession(owner: SessionOwner): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.session.create({
    data: {
      token,
      expiresAt,
      teacherId: "teacherId" in owner ? owner.teacherId : undefined,
      studentId: "studentId" in owner ? owner.studentId : undefined,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentTeacher(): Promise<Teacher | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { teacher: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.teacher;
}

export async function getCurrentStudent(): Promise<Student | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { student: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.student;
}

export type CurrentUser =
  | { role: "teacher"; teacher: Teacher }
  | { role: "student"; student: Student };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { teacher: true, student: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.teacher) return { role: "teacher", teacher: session.teacher };
  if (session.student) return { role: "student", student: session.student };
  return null;
}
