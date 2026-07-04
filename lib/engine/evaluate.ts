// 评估编排：LLM 软性判断 + 确定性规则 → 完整 EvaluationResult。
// 混合架构的收口点。

import type { EvaluationRequest, EvaluationResult, Influencer } from "../types";
import { computeDeterministic } from "./deterministic";
import { judgeWithLlm } from "./llm";
import { INFLUENCERS } from "../data/challenge";

function summariseActions(req: EvaluationRequest): string {
  const a = req.actions;
  const parts: string[] = [];
  if (a.boost) parts.push(`Boost Lv${a.boost.level}`);
  if (a.ad) parts.push(`Ad spend ${a.ad.spend}`);
  if (a.audience)
    parts.push(`Targeting [${[...a.audience.demographics, ...a.audience.interests].join(", ")}]`);
  if (a.influencer) {
    const inf = INFLUENCERS.find((i) => i.id === a.influencer!.id);
    parts.push(`Influencer ${inf?.name ?? a.influencer.id}`);
  }
  return parts.length ? parts.join(" + ") : "No paid actions";
}

function summarisePrevious(req: EvaluationRequest): string {
  const p = req.previousResult;
  if (!p) return "First round, no history";
  return `Reach ${p.metrics.reach} / Engagement ${p.metrics.engagement} / CTR ${(p.metrics.ctr * 100).toFixed(1)}%`;
}

function influencerMatch(req: EvaluationRequest): number | null {
  if (!req.actions.influencer) return null;
  const inf: Influencer | undefined = INFLUENCERS.find(
    (i) => i.id === req.actions.influencer!.id,
  );
  return inf ? inf.audienceMatch : null;
}

export async function evaluate(req: EvaluationRequest): Promise<EvaluationResult> {
  const judgement = await judgeWithLlm(
    req.post,
    req.challenge,
    summariseActions(req),
    summarisePrevious(req),
  );

  const det = computeDeterministic(
    req.post,
    req.actions,
    req.challenge,
    judgement.qualityCoefficient,
    influencerMatch(req),
  );

  return {
    round: req.round,
    metrics: det.metrics,
    timeSeries: det.timeSeries,
    qualityCoefficient: judgement.qualityCoefficient,
    breakdown: det.breakdown,
    feedback: judgement.feedback,
    visibleEngagement: judgement.visibleEngagement,
  };
}

// 单局总分：奖励"进步"而非单点高分
export function computeFinalScore(
  rounds: Array<{ result: EvaluationResult }>,
): number {
  if (rounds.length === 0) return 0;
  const engs = rounds.map((r) => r.result.metrics.engagement);
  const best = Math.max(...engs);
  const last = engs[engs.length - 1];
  const improvement = last - engs[0];
  return Math.round(0.5 * best + 0.3 * last + 0.2 * Math.max(0, improvement));
}
