// 生成评测集：人造电商 query（固定列表）+ 库里已有的话题标签（动态）。
// 幂等——EvalQuery.text 有唯一约束，重复跑不会产生重复行。
// 用法: npx tsx scripts/build-eval-set.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const MANUAL_QUERIES = [
  "eco friendly sweater",
  "sustainable fashion",
  "cheap winter coat",
  "best selling accessories",
  "cozy autumn outfit",
  "affordable jewelry",
  "trendy sneakers",
  "organic cotton shirt",
  "gift for her under 50",
  "minimalist home decor",
  "vegan leather bag",
  "summer dress sale",
  "wool scarf discount",
  "handmade ceramics",
  "recycled plastic accessories",
  "green sweater",
  "limited edition release",
  "back to school deals",
  "cozy lifestyle brand",
  "buy now free shipping",
];

async function main() {
  const posts = await prisma.post.findMany({ select: { hashtags: true } });
  const tagSet = new Set<string>();
  for (const p of posts) for (const tag of p.hashtags) tagSet.add(tag.replace(/^#/, ""));

  const topicQueries = [...tagSet].slice(0, 30); // 话题标签本身就是天然的 query 候选

  let created = 0;
  for (const text of MANUAL_QUERIES) {
    const existing = await prisma.evalQuery.findUnique({ where: { text } });
    if (!existing) {
      await prisma.evalQuery.create({ data: { text, source: "manual" } });
      created++;
    }
  }
  for (const text of topicQueries) {
    const existing = await prisma.evalQuery.findUnique({ where: { text } });
    if (!existing) {
      await prisma.evalQuery.create({ data: { text, source: "topic" } });
      created++;
    }
  }

  const total = await prisma.evalQuery.count();
  console.log(`== created ${created} new eval queries, ${total} total ==`);
  console.log("\n✅ Eval set build complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
