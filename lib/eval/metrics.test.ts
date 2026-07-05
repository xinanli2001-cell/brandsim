import { describe, it, expect } from "vitest";
import { ndcgAtK, mrr, precisionAtK } from "./metrics";

describe("ndcgAtK", () => {
  it("returns 1 for a perfectly-ordered ranking", () => {
    // 相关性降序排列本身就是最优排列，NDCG 应该是 1
    expect(ndcgAtK([3, 2, 1, 0], 4)).toBeCloseTo(1, 5);
  });

  it("returns less than 1 when a highly-relevant doc is ranked lower", () => {
    const value = ndcgAtK([0, 1, 2, 3], 4);
    expect(value).toBeLessThan(1);
    expect(value).toBeGreaterThan(0);
  });

  it("returns 0 when nothing is relevant", () => {
    expect(ndcgAtK([0, 0, 0], 3)).toBe(0);
  });

  it("only considers the top k results", () => {
    // 前2个全不相关，但第3个是相关的——@2 应该看不到它
    expect(ndcgAtK([0, 0, 3], 2)).toBe(0);
  });
});

describe("mrr", () => {
  it("returns 1 when the first result is relevant", () => {
    expect(mrr([3, 0, 0])).toBe(1);
  });

  it("returns 1/2 when the first relevant result is at rank 2", () => {
    expect(mrr([1, 3, 0], 2)).toBe(0.5);
  });

  it("returns 0 when nothing meets the relevance threshold", () => {
    expect(mrr([1, 1, 1], 2)).toBe(0);
  });
});

describe("precisionAtK", () => {
  it("computes the fraction of relevant results in the top k", () => {
    // 阈值2：[3,2,1,0] 里前3个只有前2个 >= 2
    expect(precisionAtK([3, 2, 1, 0], 3, 2)).toBeCloseTo(2 / 3, 5);
  });

  it("returns 0 for an empty ranking", () => {
    expect(precisionAtK([], 5, 2)).toBe(0);
  });

  it("returns 1 when every top-k result is relevant", () => {
    expect(precisionAtK([3, 3, 2], 3, 2)).toBe(1);
  });
});
