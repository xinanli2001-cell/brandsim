// 老师端挑战管理自测：编辑（无学生时全字段可改 / 有学生时结构字段锁死）、
// 归档/取消归档（列表可见性）、永久删除（级联清空 group/round）。
// 运行前需 `npm run dev` 已在 localhost:3000 启动，且已执行过 `npm run db:seed`。
// 用法: npx tsx scripts/test-teacher-management.ts

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

async function loginTeacher(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "teacher", email: "teacher@example.com", password: "password123" }),
  });
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("teacher login failed — did you run `npm run db:seed`?");
  return cookie.split(";")[0];
}

async function loginStudent(email: string, displayName: string): Promise<string> {
  await fetch(`${BASE}/api/auth/student/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123", displayName }),
  });
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "student", email, password: "password123" }),
  });
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("student login failed");
  return cookie.split(";")[0];
}

function baseChallengePayload(brandName: string) {
  return {
    brandName,
    brandBackground: "Throwaway brand for the teacher-management regression script.",
    goal: "Grow awareness",
    targetAudience: { coreDemographics: ["Women 18-34"], coreInterests: ["Sustainable Fashion"] },
    seasonalContext: "Winter",
    followerBase: 1000,
    totalRounds: 3,
    startingTokens: 100,
    difficulty: "normal",
    availableActions: ["boost", "ad"],
    leaderboardEnabled: true,
  };
}

async function main() {
  const teacherCookie = await loginTeacher();
  const authHeaders = { "Content-Type": "application/json", Cookie: teacherCookie };
  const suffix = Math.random().toString(36).slice(2, 8);

  // 1. 建一个挑战（无学生）
  const createRes = await fetch(`${BASE}/api/challenges`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(baseChallengePayload(`Mgmt Test ${suffix}`)),
  });
  const challenge = (await createRes.json()).challenge;
  check("Challenge created", createRes.status === 200, challenge);

  // 2. 无学生时编辑，结构字段应该真的改掉
  const editRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({ ...baseChallengePayload(`Mgmt Test Edited ${suffix}`), totalRounds: 7 }),
  });
  const edited = (await editRes.json()).challenge;
  check(
    "Edit with no students changes structural fields too",
    editRes.status === 200 && edited.totalRounds === 7 && edited.brandName === `Mgmt Test Edited ${suffix}`,
    edited,
  );

  // 3. 学生加入
  const studentCookie = await loginStudent(`mgmt-student-${suffix}@example.com`, "Mgmt Test Student");
  const joinRes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const join = await joinRes.json();
  check("Student joins the challenge", joinRes.status === 200, join);

  // 4. 有学生后编辑，结构字段应该被服务端忽略、保留原值；文本字段仍可改
  const editLockedRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({ ...baseChallengePayload(`Mgmt Test Locked ${suffix}`), totalRounds: 9, startingTokens: 9999 }),
  });
  const editedLocked = (await editLockedRes.json()).challenge;
  check(
    "Edit with students locks structural fields but still allows text fields",
    editLockedRes.status === 200 &&
      editedLocked.totalRounds === 7 && // unchanged from step 2, NOT 9
      editedLocked.startingTokens === 100 && // unchanged, NOT 9999
      editedLocked.brandName === `Mgmt Test Locked ${suffix}`, // text field did change
    editedLocked,
  );

  // 5. 归档：默认列表看不到，?archived=true 能看到
  const archiveRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ archived: true }),
  });
  check("Archive succeeds", archiveRes.status === 200);

  const activeList = await fetch(`${BASE}/api/challenges`, { headers: { Cookie: teacherCookie } }).then((r) => r.json());
  check(
    "Archived challenge is hidden from the default (active) list",
    !activeList.challenges.some((c: { id: string }) => c.id === challenge.id),
    activeList,
  );

  const archivedList = await fetch(`${BASE}/api/challenges?archived=true`, { headers: { Cookie: teacherCookie } }).then((r) =>
    r.json(),
  );
  check(
    "Archived challenge appears in the archived list",
    archivedList.challenges.some((c: { id: string }) => c.id === challenge.id),
    archivedList,
  );

  // 6. 取消归档
  const unarchiveRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ archived: false }),
  });
  const unarchived = (await unarchiveRes.json()).challenge;
  check("Unarchive succeeds and clears archivedAt", unarchiveRes.status === 200 && unarchived.archivedAt === null, unarchived);

  // 7. 另一个老师不能编辑/删除这个挑战
  const otherTeacherEmail = `mgmt-teacher-${suffix}@example.com`;
  await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: otherTeacherEmail, password: "password123" }),
  });
  const otherLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "teacher", email: otherTeacherEmail, password: "password123" }),
  });
  const otherCookie = otherLoginRes.headers.get("set-cookie")?.split(";")[0];
  if (!otherCookie) throw new Error("no other-teacher cookie, aborting");
  const foreignEditRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: otherCookie },
    body: JSON.stringify(baseChallengePayload("Hijack Attempt")),
  });
  check("A different teacher cannot edit this challenge", foreignEditRes.status === 403);
  const foreignDeleteRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "DELETE",
    headers: { Cookie: otherCookie },
  });
  check("A different teacher cannot delete this challenge", foreignDeleteRes.status === 403);

  // 8. 永久删除：级联清掉 group/round，学生端也看不到了
  const deleteRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "DELETE",
    headers: { Cookie: teacherCookie },
  });
  check("Owning teacher can permanently delete", deleteRes.status === 200);

  const getAfterDeleteRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, { headers: { Cookie: teacherCookie } });
  check("Challenge is really gone after delete", getAfterDeleteRes.status === 404);

  const studentListAfterDelete = await fetch(`${BASE}/api/student/challenges`, { headers: { Cookie: studentCookie } }).then(
    (r) => r.json(),
  );
  check(
    "Deleted challenge's group no longer appears in the student's list (cascade worked)",
    !studentListAfterDelete.challenges.some((c: { challengeId: string }) => c.challengeId === challenge.id),
    studentListAfterDelete,
  );

  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\n✅ Teacher challenge management PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
