// Prisma 7: 连接串从 schema.prisma 移到这里。
// Day5 部署时把 provider 换 postgresql、DATABASE_URL 指向 Neon，此处无需改动。
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
