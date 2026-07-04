// 关键词内容审核：拦截学生发帖里的粗口/不当用语。
// 用 obscenity 维护的英文词库做匹配，而不是自己手写一份词表——覆盖更全，也不用在源码里堆脏话。
// 后续如果要求更高，把 checkContent 换成调用第三方 moderation API（如 OpenAI Moderation），调用方不用改。

import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

export function checkContent(text: string): ModerationResult {
  if (matcher.hasMatch(text)) {
    return {
      allowed: false,
      reason: "Your post contains language that isn't allowed here. Please revise and resubmit.",
    };
  }
  return { allowed: true };
}
