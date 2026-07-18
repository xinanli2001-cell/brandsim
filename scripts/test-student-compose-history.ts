// 学生 compose 预填和历史格式化自测：只继承上一轮帖子内容，不继承投放动作。
// 用法: npx tsx scripts/test-student-compose-history.ts

import { getInitialComposeDraft, toHistoryItems } from "../lib/play/compose-history";
import type { GameState } from "../lib/types";

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`✅ ${label}`);
  } else {
    console.error(`❌ ${label}`, detail ?? "");
    failures++;
  }
}

const gameState: GameState = {
  challengeId: "challenge_test",
  currentRound: 3,
  totalRounds: 3,
  tokenBalance: 70,
  status: "in_progress",
  history: [
    {
      round: 1,
      post: {
        id: "post_1",
        challengeId: "challenge_test",
        round: 1,
        text: "First post",
        hashtags: ["#First"],
        hasImage: true,
        imageStyle: "retro",
        scheduledDay: "Mon",
        scheduledHour: 10,
      },
      actions: { round: 1, boost: { level: 3, cost: 9 }, totalCost: 9 },
      result: {
        round: 1,
        metrics: {
          impressions: 100,
          reach: 80,
          clicks: 6,
          socialClicks: 4,
          ctr: 0.06,
          engagement: 22,
          likes: 18,
          comments: 4,
          hashtagPerformance: [],
          audienceActivityScore: 1,
        },
        timeSeries: { byHour: [], byDay: [] },
        qualityCoefficient: 1.05,
        breakdown: [],
        feedback: "Good start",
        visibleEngagement: [],
      },
    },
    {
      round: 2,
      post: {
        id: "post_2",
        challengeId: "challenge_test",
        round: 2,
        text: "Second post with stronger CTA",
        hashtags: ["#Second", "#CTA"],
        hasImage: true,
        imageStyle: "natural",
        scheduledDay: "Fri",
        scheduledHour: 19,
      },
      actions: {
        round: 2,
        boost: { level: 2, cost: 6 },
        ad: { spend: 15, cost: 15 },
        audience: { demographics: ["Students"], interests: ["Fashion"], cost: 4 },
        totalCost: 25,
      },
      result: {
        round: 2,
        metrics: {
          impressions: 220,
          reach: 170,
          clicks: 18,
          socialClicks: 12,
          ctr: 0.08,
          engagement: 48,
          likes: 38,
          comments: 10,
          hashtagPerformance: [],
          audienceActivityScore: 1.1,
        },
        timeSeries: { byHour: [], byDay: [] },
        qualityCoefficient: 1.12,
        breakdown: [],
        feedback: "CTA improved",
        visibleEngagement: [],
      },
    },
  ],
};

const draft = getInitialComposeDraft(gameState);
check("Draft inherits previous post text", draft.text === "Second post with stronger CTA", draft);
check("Draft inherits previous hashtags", draft.hashtags.join(",") === "#Second,#CTA", draft);
check("Draft inherits previous image style and timing", draft.imageStyle === "natural" && draft.day === "Fri" && draft.hour === 19, draft);
check(
  "Draft resets every paid action instead of reusing previous spend",
  draft.boostLevel === 1 &&
    draft.adSpend === 0 &&
    draft.demographics.length === 0 &&
    draft.interests.length === 0 &&
    draft.influencerId === null,
  draft,
);

const history = toHistoryItems(gameState);
check("History exposes one item per submitted round", history.length === 2, history);
check(
  "History keeps post, actions, and result summaries together",
  history[1]?.round === 2 &&
    history[1]?.text === "Second post with stronger CTA" &&
    history[1]?.totalCost === 25 &&
    history[1]?.engagement === 48 &&
    history[1]?.feedback === "CTA improved",
  history[1],
);

if (failures > 0) {
  console.error(`\n❌ ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\n✅ Student compose history PASS");
