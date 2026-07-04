// 引擎自测：可复现性 + 内容区分度。无需 DB / API key（走确定性桩）。
// 运行: npx tsx scripts/test-engine.ts

import { evaluate } from "../lib/engine/evaluate";
import { DEFAULT_CHALLENGE } from "../lib/data/challenge";
import type { EvaluationRequest, Post, ActionSelection } from "../lib/types";

function makeReq(post: Post, actions: ActionSelection): EvaluationRequest {
  return { challenge: DEFAULT_CHALLENGE, post, actions, previousResult: null, round: post.round };
}

const goodPost: Post = {
  id: "post_good_1",
  challengeId: DEFAULT_CHALLENGE.id,
  round: 1,
  text: "🌿 Be gentle on the planet this winter too. Our new eco-friendly green sweaters are here — click to learn more about the limited Christmas collection, a warm gift for yourself.",
  hashtags: ["#SustainableFashion", "#GreenSweater", "#ChristmasGift"],
  hasImage: true,
  imageStyle: "cozy-lifestyle",
  scheduledDay: "Wed",
  scheduledHour: 19,
};

const goodActions: ActionSelection = {
  round: 1,
  boost: { level: 1, cost: 3 },
  audience: { demographics: ["Women 18-34"], interests: ["Sustainable Fashion"], cost: 4 },
  influencer: { id: "inf_ecolena", cost: 5 },
  totalCost: 12,
};

const spamPost: Post = {
  id: "post_spam_1",
  challengeId: DEFAULT_CHALLENGE.id,
  round: 1,
  text: "aaa",
  hashtags: ["#a", "#b", "#c", "#d", "#e", "#f", "#g", "#h", "#i", "#j"],
  hasImage: false,
  scheduledDay: "Sun",
  scheduledHour: 3,
};

const spamActions: ActionSelection = { round: 1, totalCost: 0 };

async function main() {
  const a = await evaluate(makeReq(goodPost, goodActions));
  const b = await evaluate(makeReq(goodPost, goodActions));
  const spam = await evaluate(makeReq(spamPost, spamActions));

  const reproducible = JSON.stringify(a.metrics) === JSON.stringify(b.metrics);

  console.log("== Reproducibility (same post twice) ==");
  console.log("identical metrics:", reproducible ? "✅ PASS" : "❌ FAIL");

  console.log("\n== Good post vs spam post ==");
  console.log("good  reach/engagement:", a.metrics.reach, "/", a.metrics.engagement);
  console.log("spam  reach/engagement:", spam.metrics.reach, "/", spam.metrics.engagement);
  console.log("good post wins:", a.metrics.engagement > spam.metrics.engagement ? "✅ PASS" : "❌ FAIL");

  console.log("\n== Good post breakdown (explainability) ==");
  a.breakdown.forEach((b) => console.log(`  ${b.factor}: ${b.effect}  (${b.note})`));
  console.log("\n  feedback:", a.feedback);
  console.log("  visibleEngagement count:", a.visibleEngagement.length);
  console.log("  sample:", a.visibleEngagement.slice(0, 3));

  if (!reproducible || a.metrics.engagement <= spam.metrics.engagement) {
    process.exit(1);
  }
}

main();
