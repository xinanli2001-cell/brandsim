// 端到端流程自测：登录（老师建挑战 + 学生登录）-> join -> 提交N轮 -> finished -> 真实排行榜。
// 运行前需 `npm run dev` 已在 localhost:3000 启动，且已执行过 `npm run db:seed`（提供种子老师/学生账号）。
// 用法: npx tsx scripts/test-flow.ts

export {};

const BASE = "http://localhost:3000";

async function login(role: "teacher" | "student", email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Failed to log in as ${role} (${email}) — did you run \`npm run db:seed\`?`);
  }
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("Login response did not set a session cookie");
  return cookie.split(";")[0];
}

async function createThrowawayChallenge(
  teacherCookie: string,
): Promise<{ id: string; joinCode: string; totalRounds: number }> {
  const res = await fetch(`${BASE}/api/challenges`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({
      brandName: "Test Flow Brand " + Math.random().toString(36).slice(2, 6),
      brandBackground: "A throwaway brand created by the test-flow regression script.",
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
  const data = await res.json();
  if (!res.ok) throw new Error("Failed to create throwaway challenge: " + JSON.stringify(data));
  return data.challenge;
}

async function main() {
  const teacherCookie = await login("teacher", "teacher@example.com", "password123");
  const challenge = await createThrowawayChallenge(teacherCookie);
  console.log("== created challenge ==", challenge.id, challenge.joinCode);

  const studentCookie = await login("student", "student@example.com", "password123");
  const authHeaders = { "Content-Type": "application/json", Cookie: studentCookie };

  const joinRes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const join = await joinRes.json();
  console.log("== join ==", joinRes.status, { groupId: join.groupId, tokenBalance: join.gameState?.tokenBalance });
  if (!joinRes.ok) throw new Error("join failed");

  const groupId = join.groupId;
  const totalRounds = join.challenge.totalRounds;

  for (let round = 1; round <= totalRounds; round++) {
    const res = await fetch(`${BASE}/api/rounds`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        groupId,
        post: {
          id: `post_flow_${groupId}_${round}`,
          text: `🌿 Round ${round}: eco-friendly green sweaters, limited release — click to learn more`,
          hashtags: ["#SustainableFashion", "#GreenSweater"],
          hasImage: true,
          imageStyle: "cozy-lifestyle",
          scheduledDay: "Wed",
          scheduledHour: 19,
        },
        actions: {
          boost: { level: 1, cost: 3 },
          audience: { demographics: ["Women 18-34"], interests: ["Sustainable Fashion"], cost: 4 },
          totalCost: 7,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("round failed", res.status, data);
      process.exit(1);
    }
    console.log(
      `== round ${round} ==`,
      "reach:", data.result.metrics.reach,
      "engagement:", data.result.metrics.engagement,
      "tokenBalance:", data.gameState.tokenBalance,
      "status:", data.gameState.status,
    );
  }

  const lbRes = await fetch(`${BASE}/api/leaderboard/${challenge.id}?groupId=${groupId}`, {
    headers: { Cookie: studentCookie },
  });
  const lb = await lbRes.json();
  console.log("== leaderboard ==", lbRes.status);
  console.table(lb.entries);

  const you = lb.entries.find((e: { isYou: boolean }) => e.isYou);
  if (!you) throw new Error("This group did not appear on the leaderboard");
  console.log("\n✅ End-to-end flow PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
