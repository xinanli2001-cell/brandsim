// 鉴权集成：学生注册->me=student->被挡在建挑战外(403)；老师注册->能建挑战(需要合法 body 才 200，否则 422 但不是 401/403)。
// 运行前需 `npm run dev` 在 localhost:3000。用法: npx tsx scripts/test-auth.ts
export {};
const BASE = "http://localhost:3000";
const rnd = Math.random().toString(36).slice(2, 8);

async function jar(path: string, init: RequestInit, cookieFile: string[]) {
  const headers = new Headers(init.headers);
  if (cookieFile.length) headers.set("cookie", cookieFile.join("; "));
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookieFile.push(setCookie.split(";")[0]);
  return res;
}

async function main() {
  // --- 学生 ---
  const studentJar: string[] = [];
  const su = await jar("/api/auth/signup", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `stu_${rnd}@ex.com`, password: "password123", role: "teacher" }), // 故意塞 role=teacher
  }, studentJar);
  const suBody = await su.json();
  if (su.status !== 200) throw new Error("student signup failed: " + JSON.stringify(suBody));
  if (suBody.user.role !== "student") throw new Error("SECURITY: signup did not force role=student, got " + suBody.user.role);
  console.log("== student signup ==", suBody.user.role);

  const me = await jar("/api/auth/me", { method: "GET" }, studentJar);
  const meBody = await me.json();
  if (meBody.user.role !== "student") throw new Error("me role mismatch");

  // 学生尝试建挑战 -> 必须 403
  const forbid = await jar("/api/challenges", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
  }, studentJar);
  if (forbid.status !== 403) throw new Error("SECURITY: student was NOT blocked from creating challenge, status=" + forbid.status);
  console.log("== student blocked from /api/challenges ==", forbid.status);

  // --- 老师 ---
  const teacherJar: string[] = [];
  const tu = await jar("/api/auth/teacher-signup", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `tch_${rnd}@ex.com`, password: "password123" }),
  }, teacherJar);
  const tuBody = await tu.json();
  if (tu.status !== 200 || tuBody.user.role !== "teacher") throw new Error("teacher signup failed: " + JSON.stringify(tuBody));
  console.log("== teacher signup ==", tuBody.user.role);

  // 老师建挑战：空 body 应是 422(校验失败) 而不是 401/403(鉴权失败)
  const teacherPost = await jar("/api/challenges", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
  }, teacherJar);
  if (teacherPost.status === 401 || teacherPost.status === 403) throw new Error("teacher wrongly blocked, status=" + teacherPost.status);
  console.log("== teacher passes guard on /api/challenges ==", teacherPost.status, "(422 = validation, expected)");

  console.log("\n✅ Auth integration PASS");
}
main().catch((e) => { console.error(e); process.exit(1); });
