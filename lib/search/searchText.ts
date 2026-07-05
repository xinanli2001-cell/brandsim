// 把帖子正文 + 话题标签 + 关联商品信息拼成一段可搜索文本，写时计算、读时直接用，
// 避免搜索请求里现拼多表 JOIN。

interface BuildSearchTextProduct {
  title: string;
  category: string;
  tags: string[];
}

interface BuildSearchTextInput {
  text: string;
  hashtags: string[];
  product?: BuildSearchTextProduct | null;
}

export function buildSearchText(input: BuildSearchTextInput): string {
  const parts = [input.text, ...input.hashtags];
  if (input.product) {
    parts.push(input.product.title, input.product.category, ...input.product.tags);
  }
  return parts.join(" ");
}
