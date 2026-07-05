// DB 冒烟：确认能连上 Postgres、种子后能读到内置挑战。
// 用法: npx prisma migrate deploy && npx tsx prisma/seed.ts && npx tsx scripts/test-db.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const challenge = await prisma.challenge.findUnique({ where: { joinCode: "GREEN1" } });
  if (!challenge) throw new Error("seeded challenge GREEN1 not found — did seed run?");
  console.log("== db ok ==", { id: challenge.id, brand: challenge.brandName });
  console.log("\n✅ DB smoke PASS");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
