// 老师端统计自测：学生进度名单、全局代币经济、全局报告汇总。
// 运行前需 `npm run dev` 已在 localhost:3000 启动，且已执行过 `npm run db:seed`。
// 用法: npx tsx scripts/test-teacher-insights.ts

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

async function signupStudent(email: string, displayName: string) {
  await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123", displayName }),
  });
  const { cookie } = await login("student", email, "password123");
  if (!cookie) throw new Error(`student login failed for ${email}`);
  return cookie;
}

function challengePayload(brandName: string) {
  return {
    brandName,
    brandBackground: "A regression-test brand for teacher insight dashboards.",
    goal: "Grow qualified clicks",
    targetAudience: {
      coreDemographics: ["Students 18-24", "Young professionals"],
      coreInterests: ["Sustainable Fashion", "Campus Life"],
    },
    seasonalContext: "Back to school",
    followerBase: 1200,
    totalRounds: 3,
    startingTokens: 100,
    difficulty: "normal",
    availableActions: ["boost", "ad", "audience", "influencer"],
    leaderboardEnabled: true,
  };
}

async function main() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const teacherLogin = await login("teacher", "teacher@example.com", "password123");
  if (!teacherLogin.cookie) throw new Error("teacher login failed — did you run `npm run db:seed`?");
  const teacherHeaders = { "Content-Type": "application/json", Cookie: teacherLogin.cookie };

  const createRes = await fetch(`${BASE}/api/challenges`, {
    method: "POST",
    headers: teacherHeaders,
    body: JSON.stringify(challengePayload(`Insights Test ${suffix}`)),
  });
  const challenge = (await createRes.json()).challenge;
  check("Challenge created for teacher insights", createRes.status === 200, challenge);

  const studentACookie = await signupStudent(`insights-a-${suffix}@example.com`, "Insights Alice");
  const studentBCookie = await signupStudent(`insights-b-${suffix}@example.com`, "Insights Blake");

  const joinARes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentACookie },
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const joinA = await joinARes.json();
  check("First student joins", joinARes.status === 200, joinA);

  const joinBRes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentBCookie },
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const joinB = await joinBRes.json();
  check("Second student joins", joinBRes.status === 200, joinB);

  const roundRes = await fetch(`${BASE}/api/rounds`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentACookie },
    body: JSON.stringify({
      groupId: joinA.groupId,
      post: {
        id: `post_${joinA.groupId}_1`,
        text: "Start the semester with a lighter closet. Tap the link to explore the recycled campus capsule.",
        hashtags: ["#SustainableFashion", "#CampusLife"],
        hasImage: true,
        imageStyle: "natural",
        scheduledDay: "Mon",
        scheduledHour: 10,
      },
      actions: {
        boost: { level: 2, cost: 6 },
        ad: { spend: 10, cost: 10 },
        audience: {
          demographics: ["Students 18-24"],
          interests: ["Campus Life"],
          cost: 4,
        },
        totalCost: 20,
      },
    }),
  });
  const round = await roundRes.json();
  check("A submitted round creates spend and performance data", roundRes.status === 200, round);

  const studentsRes = await fetch(`${BASE}/api/challenges/${challenge.id}/students`, {
    headers: { Cookie: teacherLogin.cookie },
  });
  const students = await studentsRes.json();
  const alice = students.students?.find((s: { displayName: string }) => s.displayName === "Insights Alice");
  const blake = students.students?.find((s: { displayName: string }) => s.displayName === "Insights Blake");
  check("Student progress endpoint returns both active joined students", studentsRes.status === 200 && alice && blake, students);
  check(
    "Student progress exposes clear progress states",
    alice?.completedRounds === 1 &&
      alice?.totalRounds === 3 &&
      alice?.progressStatus === "in_progress" &&
      alice?.tokenBalance === 80 &&
      blake?.completedRounds === 0 &&
      blake?.progressStatus === "not_started",
    { alice, blake },
  );

  await fetch(`${BASE}/api/groups/${joinB.groupId}/leave`, {
    method: "POST",
    headers: { Cookie: studentBCookie },
  });
  const studentsAfterLeave = await fetch(`${BASE}/api/challenges/${challenge.id}/students`, {
    headers: { Cookie: teacherLogin.cookie },
  }).then((r) => r.json());
  check(
    "Student progress excludes soft-left students",
    !studentsAfterLeave.students?.some((s: { displayName: string }) => s.displayName === "Insights Blake"),
    studentsAfterLeave,
  );

  const economyRes = await fetch(`${BASE}/api/teacher/token-economy`, {
    headers: { Cookie: teacherLogin.cookie },
  });
  const economy = await economyRes.json();
  const economyChallenge = economy.byChallenge?.find((c: { challengeId: string }) => c.challengeId === challenge.id);
  check(
    "Token economy aggregates total spend and action totals",
    economyRes.status === 200 &&
      economy.totalSpent >= 20 &&
      economy.actionTotals?.boost >= 6 &&
      economy.actionTotals?.ad >= 10 &&
      economy.actionTotals?.audience >= 4 &&
      economy.mostUsedAction?.uses > 0 &&
      economyChallenge?.totalSpent === 20,
    economy,
  );

  const reportsRes = await fetch(`${BASE}/api/teacher/reports`, {
    headers: { Cookie: teacherLogin.cookie },
  });
  const reports = await reportsRes.json();
  const reportChallenge = reports.challenges?.find((c: { challengeId: string }) => c.challengeId === challenge.id);
  check(
    "Reports aggregate class performance by challenge",
    reportsRes.status === 200 &&
      reports.overview?.totalChallenges >= 1 &&
      reports.overview?.averageEngagement > 0 &&
      reportChallenge?.participantCount === 1 &&
      reportChallenge?.completedRounds === 1 &&
      reportChallenge?.completionRate > 0 &&
      reportChallenge?.averageEngagement > 0,
    reports,
  );

  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\n✅ Teacher insights PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
