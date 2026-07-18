// 回填历史帖子的 searchText（Task 1/2 之前建的帖子这一列还是默认空串）。
// 用法: npx tsx scripts/backfill-search-text.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildSearchText } from "../lib/search/searchText";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const posts = await prisma.post.findMany({ include: { product: true } });
  let updated = 0;
  for (const post of posts) {
    const searchText = buildSearchText({
      text: post.text,
      hashtags: post.hashtags,
      product: post.product
        ? { title: post.product.title, category: post.product.category, tags: post.product.tags }
        : null,
    });
    if (searchText !== post.searchText) {
      await prisma.post.update({ where: { id: post.id }, data: { searchText } });
      updated++;
    }
  }
  console.log(`== backfilled searchText for ${updated}/${posts.length} posts ==`);
  console.log("\n✅ Backfill complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
