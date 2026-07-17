// 学生账号体系自测：注册/重复邮箱拒绝/角色登录隔离/加入-退出-重新加入/未登录访问被拒/重名去重。
// 运行前需 `npm run dev` 已在 localhost:3000 启动，且已执行过 `npm run db:seed`。
// 用法: npx tsx scripts/test-student-auth.ts

export {};

const BASE = "http://localhost:3000";
let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`✅ ${label}`);
  } else {
    console.error(`❌ ${label}`, detail ?? "");
    failures++;
  }
}

async function login(role: "teacher" | "student", email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, email, password }),
  });
  const cookie = res.headers.get("set-cookie");
  return { res, cookie: cookie ? cookie.split(";")[0] : null };
}

async function main() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `student-${suffix}@example.com`;
  const password = "password123";
  const displayName = "Auth Test Student";

  // 1. 学生注册
  const signupRes = await fetch(`${BASE}/api/auth/student/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });
  const signup = await signupRes.json();
  check("Student signup succeeds", signupRes.status === 200, signup);

  // 2. 重复邮箱注册被拒
  const dupRes = await fetch(`${BASE}/api/auth/student/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });
  check("Duplicate email signup rejected with 409", dupRes.status === 409, await dupRes.json());

  // 3. 用学生邮箱走老师登录角色应失败（没有同邮箱的 Teacher 行）
  const wrongRole = await login("teacher", email, password);
  check("Student credentials rejected for teacher-role login", wrongRole.res.status === 401);

  // 4. 正常学生登录
  const { res: loginRes, cookie: studentCookie } = await login("student", email, password);
  check("Student login succeeds", loginRes.status === 200 && !!studentCookie);
  if (!studentCookie) throw new Error("no student cookie, aborting");
  const authHeaders = { "Content-Type": "application/json", Cookie: studentCookie };

  // 5. 未登录访问 /api/student/challenges 被拒
  const anonRes = await fetch(`${BASE}/api/student/challenges`);
  check("Unauthenticated challenge list request rejected with 401", anonRes.status === 401);

  // 6. 老师建一个挑战供加入
  const teacherLogin = await login("teacher", "teacher@example.com", "password123");
  if (!teacherLogin.cookie) throw new Error("no teacher cookie, aborting");
  const challengeRes = await fetch(`${BASE}/api/challenges`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherLogin.cookie },
    body: JSON.stringify({
      brandName: "Auth Test Brand",
      brandBackground: "Throwaway brand for the auth regression script.",
      goal: "Grow awareness",
      targetAudience: { coreDemographics: ["Women 18-34"], coreInterests: ["Sustainable Fashion"] },
      seasonalContext: "Winter",
      followerBase: 1000,
      totalRounds: 3,
      startingTokens: 100,
      difficulty: "normal",
      availableActions: ["boost", "ad", "audience", "influencer"],
      leaderboardEnabled: true,
    }),
  });
  const challenge = (await challengeRes.json()).challenge;

  // 7. 学生加入
  const joinRes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const join = await joinRes.json();
  check("Join succeeds", joinRes.status === 200, join);
  const groupId = join.groupId;

  // 8. 挑战列表里能看到刚加入的
  const listRes = await fetch(`${BASE}/api/student/challenges`, { headers: { Cookie: studentCookie } });
  const list = await listRes.json();
  check(
    "Newly joined challenge appears in the list",
    list.challenges.some((c: { groupId: string }) => c.groupId === groupId),
    list,
  );

  // 9. 另一个学生用相同显示名 join 同一挑战，重名应自动加后缀
  const email2 = `student-${suffix}-b@example.com`;
  await fetch(`${BASE}/api/auth/student/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email2, password, displayName }), // 相同 displayName，制造重名
  });
  const { cookie: student2Cookie } = await login("student", email2, password);
  if (!student2Cookie) throw new Error("no second student cookie, aborting");
  const join2Res = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: student2Cookie },
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const join2 = await join2Res.json();
  check(
    "Duplicate display name in the same challenge gets a distinct group",
    join2.gameState && join.groupId !== join2.groupId,
    join2,
  );

  // 10. 退出挑战：从列表移除，但数据仍在（重新加入拿回同一个 group）
  const leaveRes = await fetch(`${BASE}/api/groups/${groupId}/leave`, {
    method: "POST",
    headers: { Cookie: studentCookie },
  });
  check("Leave request succeeds", leaveRes.status === 200);

  const listAfterLeave = await fetch(`${BASE}/api/student/challenges`, { headers: { Cookie: studentCookie } });
  const listAfterLeaveData = await listAfterLeave.json();
  check(
    "Left challenge no longer appears in the list",
    !listAfterLeaveData.challenges.some((c: { groupId: string }) => c.groupId === groupId),
    listAfterLeaveData,
  );

  const rejoinRes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const rejoin = await rejoinRes.json();
  check("Rejoining after leaving reuses the same group (data retained)", rejoin.groupId === groupId, rejoin);

  // 11. 另一个学生不能读取/提交别人的 group
  const foreignGameRes = await fetch(`${BASE}/api/game/${groupId}`, { headers: { Cookie: student2Cookie } });
  check("A different student cannot view someone else's group", foreignGameRes.status === 403);

  // 12. 登出后 /api/auth/me 变为未登录
  await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Cookie: studentCookie } });
  const meAfterLogout = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: studentCookie } });
  check("Session is invalid after logout", meAfterLogout.status === 401);

  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\n✅ Student account system PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
