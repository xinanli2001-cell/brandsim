// 语义检索：query 先 embed 成向量，用 pgvector 的 <=> (余弦距离) 排序。
// 没有 key、embedding 调用失败、或者库里没有任何已 embed 的帖子时，
// 整个退化成关键词检索——这是刻意设计的兜底，不是 bug。

import { prisma } from "@/lib/db";
import { embedText } from "./embeddings";
import { searchKeyword } from "./keyword";
import type { SearchHit } from "./keyword";

export async function searchSemantic(query: string, limit: number): Promise<SearchHit[]> {
  const vec = await embedText(query);
  if (!vec) return searchKeyword(query, limit);

  const vecLiteral = `[${vec.join(",")}]`;
  const rows = await prisma.$queryRaw<Array<{ id: string; score: number }>>`
    SELECT "id", 1 - (embedding <=> ${vecLiteral}::vector) AS score
    FROM "Post"
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vecLiteral}::vector
    LIMIT ${limit}
  `;

  if (rows.length === 0) return searchKeyword(query, limit);
  return rows.map((r) => ({ postId: r.id, score: r.score }));
}
