// 确定性基线引擎：数值量级完全由规则决定（可复现、可解释、抗话术）。
// LLM 只提供 qualityCoefficient(0.7~1.3) 作为内容质量软性系数传入这里。

import type {
  ActionSelection,
  Challenge,
  Day,
  Metrics,
  Post,
} from "../types";
import { clamp, makeRng } from "./seed";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface FactorContribution {
  factor: string;
  multiplier: number; // 1.0 = no effect
  note: string;
}

function pct(mult: number): string {
  const p = Math.round((mult - 1) * 100);
  return `${p >= 0 ? "+" : ""}${p}%`;
}

// ---- factors (each returns a multiplier + explanation, used in the breakdown) ----

function audienceMatchFactor(
  actions: ActionSelection,
  challenge: Challenge,
): FactorContribution {
  const a = actions.audience;
  if (!a || (a.demographics.length === 0 && a.interests.length === 0)) {
    return {
      factor: "Audience Targeting",
      multiplier: 0.85,
      note: "No targeting set — broader reach but lower efficiency",
    };
  }
  const demoHit = a.demographics.filter((d) =>
    challenge.targetAudience.coreDemographics.includes(d),
  ).length;
  const intHit = a.interests.filter((i) =>
    challenge.targetAudience.coreInterests.includes(i),
  ).length;
  const totalCore =
    challenge.targetAudience.coreDemographics.length +
    challenge.targetAudience.coreInterests.length || 1;
  const hitRatio = (demoHit + intHit) / totalCore;
  const mult = 0.95 + hitRatio * 0.45; // 0.95..1.4
  return {
    factor: "Audience Targeting",
    multiplier: clamp(mult, 0.9, 1.4),
    note:
      hitRatio > 0.5
        ? "Precisely matched the core audience"
        : "Targeting partially matches the core audience",
  };
}

function influencerFactor(
  actions: ActionSelection,
  influencerMatch: number | null,
): FactorContribution {
  if (!actions.influencer || influencerMatch == null) {
    return { factor: "Influencer Collab", multiplier: 1, note: "No influencer collab this round" };
  }
  const mult = 1 + influencerMatch * 0.4; // higher match = bigger boost
  return {
    factor: "Influencer Collab",
    multiplier: mult,
    note: `Influencer audience match ${influencerMatch.toFixed(2)}`,
  };
}

function spendFactor(actions: ActionSelection): FactorContribution {
  const boostLvl = actions.boost?.level ?? 0;
  const adSpend = actions.ad?.spend ?? 0;
  const mult = (1 + boostLvl * 0.15) * (1 + adSpend / 50);
  const note =
    boostLvl || adSpend
      ? `Boost level ${boostLvl} + ad spend ${adSpend}`
      : "No paid boost";
  return { factor: "Paid Boost", multiplier: mult, note };
}

function seasonalFactor(post: Post, challenge: Challenge): FactorContribution {
  if (!challenge.seasonalContext) {
    return { factor: "Seasonality", multiplier: 1, note: "No seasonal context" };
  }
  const hay = (post.text + " " + post.hashtags.join(" ")).toLowerCase();
  const cues = ["christmas", "winter", "sale", "holiday", "gift"];
  const hit = cues.some((c) => hay.includes(c));
  return {
    factor: "Seasonality",
    multiplier: hit ? 1.12 : 1.04,
    note: hit ? "Post taps into the seasonal moment" : "Rides the season but doesn't call it out",
  };
}

function timingFactor(post: Post): FactorContribution {
  // assume this category's audience peaks on weekdays 18:00-21:00
  const isWeekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(
    post.scheduledDay,
  );
  const inPeakHour = post.scheduledHour >= 18 && post.scheduledHour <= 21;
  let mult = 1;
  if (isWeekday && inPeakHour) mult = 1.1;
  else if (inPeakHour) mult = 1.0;
  else if (isWeekday) mult = 0.98;
  else mult = 0.92;
  return {
    factor: "Posting Time",
    multiplier: mult,
    note: inPeakHour ? "Hit the audience's peak activity window" : "Outside the audience's peak activity window",
  };
}

function structureFactor(post: Post): FactorContribution {
  let mult = 1;
  const notes: string[] = [];
  const tagCount = post.hashtags.length;
  if (tagCount >= 2 && tagCount <= 5) {
    mult *= 1.06;
    notes.push("Good hashtag count");
  } else if (tagCount > 8) {
    mult *= 0.9;
    notes.push("Too many hashtags");
  }
  if (post.hasImage) {
    mult *= 1.12;
    notes.push("Image boosts performance");
  } else {
    notes.push("No image");
  }
  return {
    factor: "Post Structure",
    multiplier: mult,
    note: notes.join(", ") || "Average structure",
  };
}

function difficultyFactor(challenge: Challenge): FactorContribution {
  const m = { easy: 1.2, normal: 1.0, hard: 0.8 }[challenge.difficulty];
  return { factor: "Difficulty Setting", multiplier: m, note: `Difficulty: ${challenge.difficulty}` };
}

// ---- main computation ----

export interface DeterministicOutput {
  metrics: Metrics;
  timeSeries: {
    byHour: Array<{ hour: number; engagement: number }>;
    byDay: Array<{ day: string; engagement: number }>;
  };
  breakdown: Array<{ factor: string; effect: string; note: string }>;
}

export function computeDeterministic(
  post: Post,
  actions: ActionSelection,
  challenge: Challenge,
  qualityCoefficient: number,
  influencerMatch: number | null,
): DeterministicOutput {
  const rng = makeRng(post.id, post.round);
  const q = clamp(qualityCoefficient, 0.7, 1.3);

  const factors: FactorContribution[] = [
    { factor: "Content Quality (AI)", multiplier: q, note: "AI-evaluated copywriting quality coefficient" },
    audienceMatchFactor(actions, challenge),
    influencerFactor(actions, influencerMatch),
    spendFactor(actions),
    seasonalFactor(post, challenge),
    timingFactor(post),
    structureFactor(post),
    difficultyFactor(challenge),
  ];

  const combined = factors.reduce((acc, f) => acc * f.multiplier, 1);
  const jitter = 0.95 + rng() * 0.1; // ±5% seeded jitter

  const reach = Math.round(challenge.followerBase * combined * jitter);
  const impressions = Math.round(reach * (1.4 + rng() * 0.3));
  const ctr = clamp(0.012 * q * (1 + (actions.audience ? 0.4 : 0)), 0.005, 0.05);
  const clicks = Math.round(impressions * ctr);
  const socialClicks = Math.round(clicks * (0.25 + rng() * 0.15));
  const engRate = clamp(0.05 * q * (post.hasImage ? 1.2 : 1), 0.02, 0.15);
  const engagement = Math.round(reach * engRate);
  const likes = Math.round(engagement * (0.7 + rng() * 0.1));
  const comments = Math.max(0, engagement - likes);

  const hashtagPerformance = post.hashtags.slice(0, 5).map((tag, i) => ({
    tag,
    impressions: Math.round(impressions * (0.35 - i * 0.05) * (0.8 + rng() * 0.4)),
    trendScore: Number((0.5 + rng() * 0.5).toFixed(2)),
  }));

  const audienceActivityScore = Number(
    clamp(0.5 + (timingFactor(post).multiplier - 1) * 2 + rng() * 0.1, 0, 1).toFixed(2),
  );

  // time series: distribute around the scheduled hour as the peak
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const dist = Math.exp(-Math.pow(h - post.scheduledHour, 2) / 8);
    return {
      hour: h,
      engagement: Math.round(engagement * dist * (0.7 + rng() * 0.6) * 0.15),
    };
  });
  const byDay = DAYS.map((day) => {
    const boost = day === post.scheduledDay ? 1.8 : 1;
    return {
      day,
      engagement: Math.round((engagement / 7) * boost * (0.7 + rng() * 0.6)),
    };
  });

  const breakdown = factors
    .filter((f) => Math.abs(f.multiplier - 1) > 0.001)
    .map((f) => ({ factor: f.factor, effect: pct(f.multiplier), note: f.note }));

  return {
    metrics: {
      impressions,
      reach,
      clicks,
      socialClicks,
      ctr: Number(ctr.toFixed(4)),
      engagement,
      likes,
      comments,
      hashtagPerformance,
      audienceActivityScore,
    },
    timeSeries: { byHour, byDay },
    breakdown,
  };
}
