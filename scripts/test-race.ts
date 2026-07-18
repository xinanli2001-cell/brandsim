// 并发自测：多个并发提交打到同一个 group，确认不会出现重复/缺失的轮次号、
// 代币扣减和实际成功的提交次数对得上——不管 Node 事件循环怎么交错调度请求。
// 运行前需 `npm run dev` 已在 localhost:3000 启动，且已执行过 `npm run db:seed`。
// 用法: npx tsx scripts/test-race.ts

export {};

const BASE = "http://localhost:3000";
const COST_PER_ATTEMPT = 5;
const CONCURRENCY = 6;

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

async function createThrowawayChallenge(teacherCookie: string): Promise<{ id: string; joinCode: string }> {
  const res = await fetch(`${BASE}/api/challenges`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({
      brandName: "Race Test Brand " + Math.random().toString(36).slice(2, 6),
      brandBackground: "A throwaway brand created by the test-race regression script.",
      goal: "Grow awareness",
      targetAudience: { coreDemographics: ["Women 18-34"], coreInterests: ["Sustainable Fashion"] },
      seasonalContext: "Winter",
      followerBase: 1000,
      totalRounds: 10,
      startingTokens: 1000,
      difficulty: "normal",
      availableActions: ["boost", "ad", "audience", "influencer"],
      leaderboardEnabled: true,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Failed to create throwaway challenge: " + JSON.stringify(data));
  return data.challenge;
}

function makeBody(groupId: string) {
  return JSON.stringify({
    groupId,
    post: {
      id: `post_race_${groupId}_${Math.random().toString(36).slice(2, 6)}`,
      text: "Race condition test post with enough length to pass validation.",
      hashtags: ["#Test"],
      hasImage: false,
      scheduledDay: "Wed",
      scheduledHour: 12,
    },
    actions: { totalCost: COST_PER_ATTEMPT },
  });
}

async function main() {
  const teacherCookie = await login("teacher", "teacher@example.com", "password123");
  const challenge = await createThrowawayChallenge(teacherCookie);

  const studentCookie = await login("student", "student@example.com", "password123");
  const authHeaders = { "Content-Type": "application/json", Cookie: studentCookie };

  const joinRes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const join = await joinRes.json();
  const groupId = join.groupId;
  const startingTokens = join.gameState.tokenBalance;
  console.log("== join ==", joinRes.status, { groupId, startingTokens });

  // 打 CONCURRENCY 个完全并发的提交请求到同一个 group，逼真实"重复点击/网络重试"
  const responses = await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      fetch(`${BASE}/api/rounds`, {
        method: "POST",
        headers: authHeaders,
        body: makeBody(groupId),
      }),
    ),
  );
  const bodies = await Promise.all(responses.map((r) => r.json()));
  const statuses = responses.map((r) => r.status);
  const successCount = statuses.filter((s) => s === 200).length;

  console.log(
    "== concurrent results ==",
    statuses.map((s, i) => `${s}:${bodies[i].error ?? "ok"}`),
  );

  const gameRes = await fetch(`${BASE}/api/game/${groupId}`, { headers: { Cookie: studentCookie } });
  const game = await gameRes.json();
  const history = game.gameState.history as Array<{ round: number }>;
  const rounds = history.map((h) => h.round).sort((a: number, b: number) => a - b);
  const expectedRounds = Array.from({ length: rounds.length }, (_, i) => i + 1);

  console.log("== persisted rounds ==", rounds);
  console.log("== token balance ==", game.gameState.tokenBalance, "(started", startingTokens, ")");

  const noDuplicateOrGap = JSON.stringify(rounds) === JSON.stringify(expectedRounds);
  const successMatchesPersisted = successCount === history.length;
  const expectedBalance = startingTokens - history.length * COST_PER_ATTEMPT;
  const tokenMathCorrect = game.gameState.tokenBalance === expectedBalance;

  console.log("\nNo duplicate/missing round numbers:", noDuplicateOrGap ? "✅ PASS" : "❌ FAIL");
  console.log("Success count matches persisted rounds:", successMatchesPersisted ? "✅ PASS" : "❌ FAIL");
  console.log(
    "Token balance math correct:",
    tokenMathCorrect ? "✅ PASS" : `❌ FAIL (expected ${expectedBalance}, got ${game.gameState.tokenBalance})`,
  );

  if (!noDuplicateOrGap || !successMatchesPersisted || !tokenMathCorrect) process.exit(1);
  console.log("\n✅ Race condition guard PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
