"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PostCard } from "@/components/PostCard";
import type { PostDTO } from "@/lib/posts";

export default function PlazaPage() {
  const [authed, setAuthed] = useState(false);
  const [backHref, setBackHref] = useState("/");
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [text, setText] = useState("");
  const [hashtagsInput, setHashtagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPosts() {
    const res = await fetch("/api/posts");
    const data = await res.json();
    setPosts(data.posts ?? []);
  }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me");
      setAuthed(res.ok);
      if (res.ok) {
        const data = await res.json();
        setBackHref(data.user.role === "teacher" ? "/teacher" : "/student");
      }
      await loadPosts();
    })();
  }, []);

  async function handleToggleLike(postId: string) {
    if (!authed) return;
    const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likedByMe: data.liked, likeCount: data.likeCount } : p,
      ),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const hashtags = hashtagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, hashtags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to post");
        return;
      }
      setText("");
      setHashtagsInput("");
      await loadPosts();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="bg-surface-bg text-on-surface min-h-screen font-body-main">
      <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 shadow-sm flex justify-between items-center px-gutter-mobile py-base w-full">
        <Link
          href="/plaza"
          className="font-headline-lg-mobile text-headline-lg-mobile font-extrabold text-primary"
        >
          MarketingSim Plaza
        </Link>
        <Link href={backHref} className="font-caption text-caption text-secondary hover:underline">
          Back
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-gutter-mobile py-stack-lg flex flex-col gap-stack-md">
        {authed ? (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E2E8F0] p-stack-md flex flex-col gap-stack-sm"
          >
            <textarea
              className="w-full px-4 py-3 bg-surface-bg border border-outline-variant rounded-xl font-body-main text-body-main outline-none focus:ring-2 focus:ring-primary"
              placeholder="What's happening in your campaign?"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <input
              className="w-full px-4 py-2 bg-surface-bg border border-outline-variant rounded-xl font-body-main text-body-main outline-none focus:ring-2 focus:ring-primary"
              placeholder="Hashtags, comma separated (e.g. SustainableFashion, GreenSweater)"
              value={hashtagsInput}
              onChange={(e) => setHashtagsInput(e.target.value)}
            />
            {error && <p className="text-error text-caption font-caption">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="self-end bg-primary text-on-primary font-title-md text-title-md px-6 py-2 rounded-xl disabled:opacity-60"
            >
              {submitting ? "Posting..." : "Post"}
            </button>
          </form>
        ) : (
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E2E8F0] p-stack-md text-center">
            <Link href="/" className="font-body-main text-body-main text-secondary hover:underline">
              Log in to post, like, and comment
            </Link>
          </div>
        )}

        {posts.map((post) => (
          <PostCard key={post.id} post={post} onToggleLike={handleToggleLike} />
        ))}
      </div>
    </main>
  );
}
