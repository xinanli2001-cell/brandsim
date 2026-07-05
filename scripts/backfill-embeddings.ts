// 给还没有 embedding 的帖子补向量。没有 OPENAI_API_KEY 时直接跳过并打印说明——
// 这不是失败，是刻意的降级路径（语义检索会退化成关键词检索）。
// 用法: npx tsx scripts/backfill-embeddings.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { embedText } from "../lib/search/embeddings";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("No OPENAI_API_KEY set — skipping embedding backfill. Semantic search will degrade to keyword search.");
    return;
  }

  const posts = await prisma.$queryRaw<Array<{ id: string; searchText: string }>>`
    SELECT "id", "searchText" FROM "Post" WHERE embedding IS NULL
  `;

  let embedded = 0;
  for (const post of posts) {
    const vec = await embedText(post.searchText);
    if (!vec) continue;
    const vecLiteral = `[${vec.join(",")}]`;
    await prisma.$executeRaw`UPDATE "Post" SET embedding = ${vecLiteral}::vector WHERE "id" = ${post.id}`;
    embedded++;
  }
  console.log(`== embedded ${embedded}/${posts.length} posts ==`);
  console.log("\n✅ Embedding backfill complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
