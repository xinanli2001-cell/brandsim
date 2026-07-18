// 纯鉴权守卫：不 import db/next，可单测。
// 服务端路由用法：const user = await getCurrentUser(); const t = assertTeacher(user);
export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function assertUser<T extends { id: string }>(user: T | null): T {
  if (!user) throw new AuthError(401, "Not logged in");
  return user;
}

export function assertTeacher<T extends { id: string; role: string }>(user: T | null): T {
  const u = assertUser(user);
  if (u.role !== "teacher") throw new AuthError(403, "Teachers only");
  return u;
}

export function assertStudent<T extends { id: string; role: string }>(user: T | null): T {
  const u = assertUser(user);
  if (u.role !== "student") throw new AuthError(403, "Students only");
  return u;
}
