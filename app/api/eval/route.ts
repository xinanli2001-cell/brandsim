import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { classifyBadCase } from "@/lib/eval/badcase";

export async function GET() {
  const runs = await prisma.evalRun.findMany({
    include: { query: true },
    orderBy: { createdAt: "desc" },
  });

  const byStrategy = new Map<
    string,
    { ndcg: number[]; mrr: number[]; precisionAt5: number[]; zero: number; total: number }
  >();
  for (const r of runs) {
    const bucket = byStrategy.get(r.strategy) ?? {
      ndcg: [],
      mrr: [],
      precisionAt5: [],
      zero: 0,
      total: 0,
    };
    bucket.ndcg.push(r.ndcg);
    bucket.mrr.push(r.mrr);
    bucket.precisionAt5.push(r.precisionAt5);
    if (r.zeroResult) bucket.zero++;
    bucket.total++;
    byStrategy.set(r.strategy, bucket);
  }

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const summary = [...byStrategy.entries()].map(([strategy, b]) => ({
    strategy,
    avgNdcg: avg(b.ndcg),
    avgMrr: avg(b.mrr),
    avgPrecisionAt5: avg(b.precisionAt5),
    zeroResultRate: b.total ? b.zero / b.total : 0,
  }));

  const badCases = runs
    .map((r) => ({
      queryText: r.query.text,
      strategy: r.strategy,
      ndcg: r.ndcg,
      precisionAt5: r.precisionAt5,
      zeroResult: r.zeroResult,
      reason: classifyBadCase(r),
    }))
    .filter((r) => r.reason !== null);

  return NextResponse.json({ summary, badCases, totalRuns: runs.length });
}
