// 端到端流程自测：join -> 提交3轮 -> finished -> 真实排行榜。
// 运行前需 `npm run dev` 已在 localhost:3000 启动。
// 用法: npx tsx scripts/test-flow.ts

export {};

const BASE = "http://localhost:3000";

async function signUpStudent(): Promise<string> {
  const email = `student_flow_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  if (!res.ok) throw new Error("student signup failed for test-flow setup");
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error("no session cookie returned from signup");
  return setCookie.split(";")[0];
}

async function main() {
  const cookie = await signUpStudent();
  const groupName = "test-group-" + Math.random().toString(36).slice(2, 7);

  const joinRes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ joinCode: "green1", groupName }),
  });
  const join = await joinRes.json();
  console.log("== join ==", joinRes.status, { groupId: join.groupId, tokenBalance: join.gameState?.tokenBalance });
  if (!joinRes.ok) throw new Error("join failed");

  const groupId = join.groupId;
  const totalRounds = join.challenge.totalRounds;

  for (let round = 1; round <= totalRounds; round++) {
    const res = await fetch(`${BASE}/api/rounds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
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

  const lbRes = await fetch(`${BASE}/api/leaderboard/${join.challenge.id}?groupId=${groupId}`);
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
