"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MaterialIcon } from "@/components/MaterialIcon";
import { PostCard } from "@/components/PostCard";
import type { PostDTO } from "@/lib/posts";

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const [email, setEmail] = useState<string>("");
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${params.id}/posts`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setEmail(data.user?.email ?? "");
        setPosts(data.posts ?? []);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

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

  if (loading) {
    return (
      <main className="bg-surface-bg min-h-screen flex items-center justify-center">
        <p className="font-body-main text-body-main text-on-surface-variant">Loading...</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="bg-surface-bg min-h-screen flex items-center justify-center">
        <p className="font-body-main text-body-main text-on-surface-variant">User not found.</p>
      </main>
    );
  }

  return (
    <main className="bg-surface-bg text-on-surface min-h-screen font-body-main">
      <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 shadow-sm flex items-center gap-4 px-gutter-mobile py-base w-full">
        <Link href="/plaza" className="font-caption text-caption text-secondary hover:underline">
          ← Back to plaza
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-gutter-mobile py-stack-lg flex flex-col gap-stack-md">
        <div className="flex items-center gap-3 pb-stack-sm">
          <MaterialIcon name="account_circle" className="text-[48px] text-on-surface-variant" />
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-extrabold text-on-surface">
            {email}
          </h1>
        </div>

        {posts.length === 0 && (
          <p className="font-body-main text-body-main text-on-surface-variant text-center">
            No posts yet.
          </p>
        )}
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onToggleLike={handleToggleLike} />
        ))}
      </div>
    </main>
  );
}
