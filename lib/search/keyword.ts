// 关键词检索：用 ILIKE 做确定性子串匹配（保证有结果就是真的匹配上了，方便测试),
// 用 pg_trgm 的 similarity() 做排序信号（相似度越高排越前）。
// GIN trigram 索引（迁移里建的）加速的是 % 相似度过滤，这里没用上，
// 但为后续调优/切换成"允许模糊匹配"留了扩展空间。

import { prisma } from "@/lib/db";

export interface SearchHit {
  postId: string;
  score: number;
}

export async function searchKeyword(query: string, limit: number): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const rows = await prisma.$queryRaw<Array<{ id: string; score: number }>>`
    SELECT "id", similarity("searchText", ${trimmed}) AS score
    FROM "Post"
    WHERE "searchText" ILIKE ${"%" + trimmed + "%"}
    ORDER BY score DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({ postId: r.id, score: r.score }));
}
