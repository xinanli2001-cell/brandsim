// LLM 评分兜底自测：无 key 环境也要按多维量规、挑战上下文、投放动作、上一轮表现给出更有依据的反馈。
// 用法: npx tsx scripts/test-llm-rubric.ts

import { stubJudgement } from "../lib/engine/llm";
import type { ActionSelection, Challenge, EvaluationResult, Post } from "../lib/types";

let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`✅ ${label}`);
  } else {
    console.error(`❌ ${label}`, detail ?? "");
    failures++;
  }
}

const challenge: Challenge = {
  id: "challenge_rubric",
  brandName: "Loop Bottle",
  brandBackground: "A reusable bottle brand for students who want durable, low-waste daily gear.",
  goal: "Drive store visits from students",
  targetAudience: {
    coreDemographics: ["Students 18-24"],
    coreInterests: ["Sustainability", "Campus Life"],
  },
  seasonalContext: "Back to school",
  followerBase: 1500,
  totalRounds: 3,
  startingTokens: 80,
  difficulty: "hard",
  availableActions: ["boost", "ad", "audience", "influencer"],
  leaderboardEnabled: true,
};

const previousResult: EvaluationResult = {
  round: 1,
  metrics: {
    impressions: 500,
    reach: 420,
    clicks: 12,
    socialClicks: 9,
    ctr: 0.024,
    engagement: 55,
    likes: 47,
    comments: 8,
    hashtagPerformance: [],
    audienceActivityScore: 0.9,
  },
  timeSeries: { byHour: [], byDay: [] },
  qualityCoefficient: 0.92,
  breakdown: [],
  feedback: "The idea was relevant, but the CTA was too soft.",
  visibleEngagement: [],
};

const weakPost: Post = {
  id: "post_weak",
  challengeId: challenge.id,
  round: 2,
  text: "Our bottle is nice.",
  hashtags: ["#Random"],
  hasImage: false,
  scheduledDay: "Sun",
  scheduledHour: 2,
};

const strongPost: Post = {
  id: "post_strong",
  challengeId: challenge.id,
  round: 2,
  text: "Back-to-school days get lighter with a reusable Loop Bottle. Visit the campus store today and bring less waste to every lecture.",
  hashtags: ["#Sustainability", "#CampusLife"],
  hasImage: true,
  imageStyle: "natural",
  scheduledDay: "Mon",
  scheduledHour: 10,
};

const focusedActions: ActionSelection = {
  round: 2,
  boost: { level: 1, cost: 3 },
  audience: { demographics: ["Students 18-24"], interests: ["Sustainability"], cost: 4 },
  totalCost: 7,
};

const broadActions: ActionSelection = {
  round: 2,
  ad: { spend: 40, cost: 40 },
  totalCost: 40,
};

const weak = stubJudgement(weakPost, challenge, broadActions, previousResult);
const strong = stubJudgement(strongPost, challenge, focusedActions, previousResult);

check(
  "Strong contextual post scores higher than weak generic post",
  strong.qualityCoefficient > weak.qualityCoefficient,
  { weak: weak.qualityCoefficient, strong: strong.qualityCoefficient },
);
check(
  "Rubric feedback mentions multiple internal scoring dimensions without exposing numeric sub-scores",
  strong.contentNotes.some((note) => /audience|target/i.test(note)) &&
    strong.contentNotes.some((note) => /CTA|call to action/i.test(note)) &&
    strong.contentNotes.some((note) => /timing|season|brand/i.test(note)) &&
    !strong.feedback.includes("/10"),
  strong,
);
check(
  "Previous performance informs feedback",
  /previous|last round|earlier/i.test(strong.feedback),
  strong.feedback,
);
check(
  "Visible engagement still stays within the existing UI contract",
  strong.visibleEngagement.length >= 7 && strong.visibleEngagement.length <= 11,
  strong.visibleEngagement.length,
);

if (failures > 0) {
  console.error(`\n❌ ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\n✅ LLM rubric PASS");
