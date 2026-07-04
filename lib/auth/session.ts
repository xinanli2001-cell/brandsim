// 教师端会话：httpOnly cookie 存一个随机 token，对应 Session 表里的一行。
// 登出即删行；服务端始终以这里返回的 teacher 作为权限判断依据，不再信任客户端自称的身份。

import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import type { Teacher } from "@prisma/client";

const COOKIE_NAME = "brandsim_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(teacherId: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.session.create({ data: { token, teacherId, expiresAt } });

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
