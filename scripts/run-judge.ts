// 对每条 EvalQuery：三路检索各取 top-10 候选，去重合并成一个候选池，
// 对候选池里还没有标注过的 (query, post) 组合调用 judgeRelevance 打分入库。
// 幂等——EvalJudgment 对 (queryId, postId) 有唯一约束，已标注过的组合会跳过。
// 运行前需 Postgres 可连接（不需要 dev server，直接操作 lib/search/* 和 DB）。
// 用法: npx tsx scripts/run-judge.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { searchKeyword } from "../lib/search/keyword";
import { searchSemantic } from "../lib/search/semantic";
import { rerank } from "../lib/search/rerank";
import { judgeRelevance } from "../lib/eval/judge";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const POOL_SIZE = 10;

async function main() {
  const queries = await prisma.evalQuery.findMany();
  let judged = 0;
  let skipped = 0;

  for (const query of queries) {
    const keywordHits = await searchKeyword(query.text, POOL_SIZE);
    const semanticHits = await searchSemantic(query.text, POOL_SIZE);
    const rerankHits = await rerank(query.text, keywordHits);

    const poolIds = new Set<string>();
    for (const hits of [keywordHits, semanticHits, rerankHits]) {
      for (const h of hits) poolIds.add(h.postId);
    }
    if (poolIds.size === 0) continue;

    const posts = await prisma.post.findMany({
      where: { id: { in: [...poolIds] } },
      include: { product: true },
    });

    for (const post of posts) {
      const existing = await prisma.evalJudgment.findUnique({
        where: { queryId_postId: { queryId: query.id, postId: post.id } },
      });
      if (existing) {
        skipped++;
        continue;
      }
      const { relevance, judgedBy } = await judgeRelevance(query.text, post);
      await prisma.evalJudgment.create({
        data: { queryId: query.id, postId: post.id, relevance, judgedBy },
      });
      judged++;
    }
  }

  console.log(`== judged ${judged} new (query, post) pairs, skipped ${skipped} already-judged ==`);
  console.log("\n✅ Judging pass complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
