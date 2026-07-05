// 统一话题标签的存储/查询形式：小写规范化，保证前缀带 #，
// 这样 Prisma 的 `hashtags: { has: tag }` 精确匹配查询才能稳定命中。
// 取舍：不保留原始大小写用于展示，MVP 阶段不需要。

export function normalizeHashtag(raw: string): string {
  const trimmed = raw.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return withHash.toLowerCase();
}
