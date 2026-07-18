// 帖子对外统一形状（PostDTO），供 /api/posts、/api/topics/[tag]、/api/users/[id]/posts 三处复用，
// 避免同一个序列化逻辑散落在多个路由里。

import type { Post, Product, User, PrismaClient } from "@prisma/client";

export interface PostDTO {
  id: string;
  text: string;
  hashtags: string[];
  imageUrl: string | null;
  source: string;
  author: { id: string; email: string };
  product: {
    id: string;
    title: string;
    category: string;
    price: number;
    tags: string[];
    imageUrl: string | null;
  } | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
}

type PostWithRelations = Post & { author: User; product: Product | null };

export function toPostDTO(post: PostWithRelations, likedByMe: boolean): PostDTO {
  return {
    id: post.id,
    text: post.text,
    hashtags: post.hashtags,
    imageUrl: post.imageUrl,
    source: post.source,
    author: { id: post.author.id, email: post.author.email },
    product: post.product
      ? {
          id: post.product.id,
          title: post.product.title,
          category: post.product.category,
          price: post.product.price,
          tags: post.product.tags,
          imageUrl: post.product.imageUrl,
        }
      : null,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    likedByMe,
    createdAt: post.createdAt.toISOString(),
  };
}

export async function computeLikedSet(
  prisma: PrismaClient,
  userId: string | null,
  postIds: string[],
): Promise<Set<string>> {
  if (!userId || postIds.length === 0) return new Set();
  const likes = await prisma.like.findMany({
    where: { userId, postId: { in: postIds } },
  });
  return new Set(likes.map((l) => l.postId));
}
