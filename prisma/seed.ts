// 初始化种子教师账号 + 内置挑战，固定加入码方便本地联调。

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { DEFAULT_CHALLENGE } from "../lib/data/challenge";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SEED_TEACHER_EMAIL = "teacher@example.com";
const SEED_TEACHER_PASSWORD = "password123";

async function main() {
  const existing = await prisma.challenge.findUnique({
    where: { joinCode: "GREEN1" },
  });
  if (existing) {
    console.log("Already exists, skipping seed:", existing.id, existing.joinCode);
    return;
  }

  let teacher = await prisma.teacher.findUnique({ where: { email: SEED_TEACHER_EMAIL } });
  if (!teacher) {
    const passwordHash = await bcrypt.hash(SEED_TEACHER_PASSWORD, 10);
    teacher = await prisma.teacher.create({
      data: { email: SEED_TEACHER_EMAIL, passwordHash },
    });
    console.log("Created seed teacher:", teacher.email, "(password: " + SEED_TEACHER_PASSWORD + ")");
  }

  const c = await prisma.challenge.create({
    data: {
      brandName: DEFAULT_CHALLENGE.brandName,
      brandBackground: DEFAULT_CHALLENGE.brandBackground,
      goal: DEFAULT_CHALLENGE.goal,
      targetAudience: DEFAULT_CHALLENGE.targetAudience,
      seasonalContext: DEFAULT_CHALLENGE.seasonalContext,
      followerBase: DEFAULT_CHALLENGE.followerBase,
      totalRounds: DEFAULT_CHALLENGE.totalRounds,
      startingTokens: DEFAULT_CHALLENGE.startingTokens,
      difficulty: DEFAULT_CHALLENGE.difficulty,
      availableActions: DEFAULT_CHALLENGE.availableActions,
      leaderboardEnabled: DEFAULT_CHALLENGE.leaderboardEnabled,
      joinCode: "GREEN1",
      teacherId: teacher.id,
    },
  });
  console.log("Created challenge:", c.id, "join code:", c.joinCode);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
