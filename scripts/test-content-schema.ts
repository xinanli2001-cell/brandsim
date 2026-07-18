// 内容广场模型冒烟测试：建一个临时 user+post+product+like+comment，
// 校验关系都能正确读回，然后清理干净。
// 用法: npx tsx scripts/test-content-schema.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const email = `schema_test_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.create({ data: { email, passwordHash, role: "student" } });

  const product = await prisma.product.create({
    data: { title: "Test Sweater", category: "Apparel", price: 42, tags: ["#test"] },
  });

  const post = await prisma.post.create({
    data: {
      authorId: user.id,
      text: "Schema smoke test post",
      hashtags: ["#test"],
      source: "free",
      productId: product.id,
    },
  });

  const like = await prisma.like.create({ data: { postId: post.id, userId: user.id } });
  const comment = await prisma.comment.create({ data: { postId: post.id, authorId: user.id, text: "nice!" } });

  const fetched = await prisma.post.findUnique({
    where: { id: post.id },
    include: { author: true, product: true, likes: true, comments: true },
  });

  if (!fetched) throw new Error("post not found after create");
  if (fetched.author.email !== email) throw new Error("author relation mismatch");
  if (fetched.product?.title !== "Test Sweater") throw new Error("product relation mismatch");
  if (fetched.likes.length !== 1) throw new Error("like relation mismatch");
  if (fetched.comments.length !== 1) throw new Error("comment relation mismatch");
  if (!fetched.hashtags.includes("#test")) throw new Error("hashtags array mismatch");

  console.log("== content schema smoke ==", {
    postId: post.id,
    author: fetched.author.email,
    product: fetched.product?.title,
    likes: fetched.likes.length,
    comments: fetched.comments.length,
  });

  await prisma.comment.delete({ where: { id: comment.id } });
  await prisma.like.delete({ where: { id: like.id } });
  await prisma.post.delete({ where: { id: post.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log("\n✅ Content schema smoke PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
