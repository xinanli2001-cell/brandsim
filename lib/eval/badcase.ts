// Bad case 归因：零结果 / 意图不匹配 / 相关性低。
// 优先级：零结果最明确，先判；其次"检索到了结果但 top5 全不相关"大概率是
// query 理解/召回策略选错了方向（意图不匹配）；剩下 NDCG 偏低的算相关性排序不够好。

export type BadCaseReason = "zero_result" | "intent_mismatch" | "low_relevance" | null;

export function classifyBadCase(run: {
  zeroResult: boolean;
  ndcg: number;
  precisionAt5: number;
}): BadCaseReason {
  if (run.zeroResult) return "zero_result";
  if (run.precisionAt5 === 0) return "intent_mismatch";
  if (run.ndcg < 0.5) return "low_relevance";
  return null;
}
