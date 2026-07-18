// 离线评测跑批：对每条 EvalQuery，用三路策略各自检索 top-10，
// 用 Task 9 已经标注好的 EvalJudgment 查相关性（没标注过的候选默认按 0 分算，
// 理论上不应该发生——Task 9 的 run-judge.ts 已经把三路检索会出现的候选全部标注过了），
// 算 NDCG@10/MRR/Precision@5/零结果，写入 EvalRun（对 (queryId, strategy) upsert，可重复跑）。
// 用法: npx tsx scripts/run-eval.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { searchKeyword } from "../lib/search/keyword";
import { searchSemantic } from "../lib/search/semantic";
import { rerank } from "../lib/search/rerank";
import { ndcgAtK, mrr, precisionAtK } from "../lib/eval/metrics";
import type { SearchHit } from "../lib/search/keyword";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const TOP_K = 10;

const STRATEGIES = ["keyword", "semantic", "llm_rerank"] as const;

async function retrieve(strategy: (typeof STRATEGIES)[number], queryText: string): Promise<SearchHit[]> {
  if (strategy === "keyword") return searchKeyword(queryText, TOP_K);
  if (strategy === "semantic") return searchSemantic(queryText, TOP_K);
  const candidates = await searchKeyword(queryText, TOP_K * 2);
  return (await rerank(queryText, candidates)).slice(0, TOP_K);
}

async function main() {
  const queries = await prisma.evalQuery.findMany();
  let runsWritten = 0;

  for (const query of queries) {
    for (const strategy of STRATEGIES) {
      const hits = await retrieve(strategy, query.text);
      const zeroResult = hits.length === 0;

      const judgments = await prisma.evalJudgment.findMany({
        where: { queryId: query.id, postId: { in: hits.map((h) => h.postId) } },
      });
      const relevanceByPostId = new Map(judgments.map((j) => [j.postId, j.relevance]));
      const relevances = hits.map((h) => relevanceByPostId.get(h.postId) ?? 0);

      const ndcg = ndcgAtK(relevances, TOP_K);
      const mrrValue = mrr(relevances);
      const precisionAt5 = precisionAtK(relevances, 5);

      await prisma.evalRun.upsert({
        where: { queryId_strategy: { queryId: query.id, strategy } },
        create: {
          queryId: query.id,
          strategy,
          resultPostIds: hits.map((h) => h.postId),
          ndcg,
          mrr: mrrValue,
          precisionAt5,
          zeroResult,
        },
        update: {
          resultPostIds: hits.map((h) => h.postId),
          ndcg,
          mrr: mrrValue,
          precisionAt5,
          zeroResult,
        },
      });
      runsWritten++;
    }
  }

  console.log(`== wrote/updated ${runsWritten} eval runs across ${queries.length} queries × ${STRATEGIES.length} strategies ==`);
  console.log("\n✅ Offline eval pass complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
