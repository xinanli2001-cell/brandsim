"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PostCard } from "@/components/PostCard";
import type { PostDTO } from "@/lib/posts";

export default function TopicPage() {
  const params = useParams<{ tag: string }>();
  const [tag, setTag] = useState<string>("");
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/topics/${params.tag}`)
      .then((res) => res.json())
      .then((data) => {
        setTag(data.tag ?? "");
        setPosts(data.posts ?? []);
      })
      .finally(() => setLoading(false));
  }, [params.tag]);

  async function handleToggleLike(postId: string) {
    const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, likedByMe: data.liked, likeCount: data.likeCount } : p,
      ),
    );
  }

  return (
    <main className="bg-surface-bg text-on-surface min-h-screen font-body-main">
      <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 shadow-sm flex justify-between items-center px-gutter-mobile py-base w-full">
        <Link href="/plaza" className="font-caption text-caption text-secondary hover:underline">
          ← Back to plaza
        </Link>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-extrabold text-primary">
          {tag || "Loading..."}
        </h1>
      </header>

      <div className="max-w-2xl mx-auto px-gutter-mobile py-stack-lg flex flex-col gap-stack-md">
        {loading && (
          <p className="font-body-main text-body-main text-on-surface-variant text-center">Loading...</p>
        )}
        {!loading && posts.length === 0 && (
          <p className="font-body-main text-body-main text-on-surface-variant text-center">
            No posts under this topic yet.
          </p>
        )}
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onToggleLike={handleToggleLike} />
        ))}
      </div>
    </main>
  );
}
