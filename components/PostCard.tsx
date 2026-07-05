"use client";

import { useState } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/MaterialIcon";
import type { PostDTO } from "@/lib/posts";

interface CommentDTO {
  id: string;
  text: string;
  author: { id: string; email: string };
  createdAt: string;
}

function tagToSlug(tag: string) {
  return encodeURIComponent(tag.replace(/^#/, ""));
}

export function PostCard({
  post,
  onToggleLike,
}: {
  post: PostDTO;
  onToggleLike: (id: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentDTO[] | null>(null);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);

  async function loadComments() {
    const res = await fetch(`/api/posts/${post.id}/comments`);
    const data = await res.json();
    setComments(data.comments ?? []);
  }

  async function toggleComments() {
    const next = !showComments;
    setShowComments(next);
    if (next && comments === null) await loadComments();
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: commentText }),
      });
      if (res.ok) {
        setCommentText("");
        await loadComments();
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E2E8F0] p-stack-md flex flex-col gap-stack-sm">
      <div className="flex items-center gap-2">
        <MaterialIcon name="account_circle" className="text-2xl text-on-surface-variant" />
        <Link
          href={`/u/${post.author.id}`}
          className="font-label-mono text-label-mono text-on-surface hover:underline"
        >
          {post.author.email}
        </Link>
        {post.source === "round" && (
          <span className="font-caption text-caption text-secondary bg-secondary-container/20 px-2 py-0.5 rounded-full">
            Campaign post
          </span>
        )}
      </div>

      <p className="font-body-main text-body-main text-on-surface whitespace-pre-wrap">{post.text}</p>

      {post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.hashtags.map((tag) => (
            <Link
              key={tag}
              href={`/topic/${tagToSlug(tag)}`}
              className="font-caption text-caption text-secondary hover:underline"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}

      {post.product && (
        <div className="flex items-center gap-2 bg-surface-container-low rounded-xl p-stack-sm">
          <MaterialIcon name="shopping_bag" className="text-tertiary" />
          <div className="flex flex-col">
            <span className="font-label-mono text-label-mono text-on-surface">{post.product.title}</span>
            <span className="font-caption text-caption text-on-surface-variant">
              {post.product.category} · ${post.product.price}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 pt-1">
        <button
          onClick={() => onToggleLike(post.id)}
          className={`flex items-center gap-1 font-caption text-caption ${
            post.likedByMe ? "text-error-rose" : "text-on-surface-variant"
          }`}
        >
          <MaterialIcon name="favorite" fill={post.likedByMe} className="text-lg" />
          {post.likeCount}
        </button>
        <button
          onClick={toggleComments}
          className="flex items-center gap-1 font-caption text-caption text-on-surface-variant"
        >
          <MaterialIcon name="chat_bubble" className="text-lg" />
          {post.commentCount}
        </button>
      </div>

      {showComments && (
        <div className="flex flex-col gap-stack-sm pt-stack-sm border-t border-outline-variant">
          {comments === null && (
            <p className="font-caption text-caption text-on-surface-variant">Loading...</p>
          )}
          {comments?.map((c) => (
            <div key={c.id} className="flex flex-col">
              <span className="font-label-mono text-label-mono text-on-surface">{c.author.email}</span>
              <span className="font-body-main text-body-main text-on-surface-variant">{c.text}</span>
            </div>
          ))}
          <form onSubmit={submitComment} className="flex gap-2 pt-1">
            <input
              className="flex-1 px-3 py-2 bg-surface-bg border border-outline-variant rounded-xl font-body-main text-body-main outline-none focus:ring-2 focus:ring-primary"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button
              type="submit"
              disabled={posting}
              className="bg-primary text-on-primary font-caption text-caption px-4 py-2 rounded-xl disabled:opacity-60"
            >
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
