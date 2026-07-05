// 评测指标纯函数。relevances 是按检索排序好的相关性分档数组（0-3），
// 顺序即排名——第0个元素是排第一的结果的相关性。

export function ndcgAtK(relevances: number[], k: number): number {
  const dcg = (rels: number[]) =>
    rels
      .slice(0, k)
      .reduce((sum, rel, i) => sum + (Math.pow(2, rel) - 1) / Math.log2(i + 2), 0);

  const idealOrder = [...relevances].sort((a, b) => b - a);
  const idealDcg = dcg(idealOrder);
  if (idealDcg === 0) return 0;
  return dcg(relevances) / idealDcg;
}

export function mrr(relevances: number[], relevantThreshold = 2): number {
  const idx = relevances.findIndex((r) => r >= relevantThreshold);
  return idx === -1 ? 0 : 1 / (idx + 1);
}

export function precisionAtK(relevances: number[], k: number, relevantThreshold = 2): number {
  const top = relevances.slice(0, k);
  if (top.length === 0) return 0;
  const relevantCount = top.filter((r) => r >= relevantThreshold).length;
  return relevantCount / top.length;
}
