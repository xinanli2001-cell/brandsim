"use client";

import { useState } from "react";
import Link from "next/link";
import { PostCard } from "@/components/PostCard";
import type { PostDTO } from "@/lib/posts";
import type { QueryUnderstanding } from "@/lib/search/query-understanding";

const STRATEGIES = [
  { value: "keyword", label: "Keyword" },
  { value: "semantic", label: "Semantic" },
  { value: "llm_rerank", label: "LLM Rerank" },
] as const;

interface SearchResultItem {
  post: PostDTO;
  score: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [strategy, setStrategy] = useState<(typeof STRATEGIES)[number]["value"]>("keyword");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [intent, setIntent] = useState<QueryUnderstanding | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&strategy=${strategy}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        return;
      }
      setResults(data.results ?? []);
      setIntent(data.intent ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleLike(postId: string) {
    const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
    if (!res.ok) return;
    const data = await res.json();
    setResults((prev) =>
      prev.map((r) =>
        r.post.id === postId
          ? { ...r, post: { ...r.post, likedByMe: data.liked, likeCount: data.likeCount } }
          : r,
      ),
    );
  }

  return (
    <main className="bg-surface-bg text-on-surface min-h-screen font-body-main">
      <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 shadow-sm flex justify-between items-center px-gutter-mobile py-base w-full">
        <Link
          href="/plaza"
          className="font-headline-lg-mobile text-headline-lg-mobile font-extrabold text-primary"
        >
          Search
        </Link>
        <Link href="/eval" className="font-caption text-caption text-secondary hover:underline">
          Eval Dashboard
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-gutter-mobile py-stack-lg flex flex-col gap-stack-md">
        <form
          onSubmit={runSearch}
          className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E2E8F0] p-stack-md flex flex-col gap-stack-sm"
        >
          <input
            className="w-full px-4 py-3 bg-surface-bg border border-outline-variant rounded-xl font-body-main text-body-main outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search posts and products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex gap-2">
            {STRATEGIES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStrategy(s.value)}
                className={`px-4 py-2 rounded-xl font-caption text-caption ${
                  strategy === s.value
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-low text-on-surface-variant"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {error && <p className="text-error text-caption font-caption">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="self-end bg-primary text-on-primary font-title-md text-title-md px-6 py-2 rounded-xl disabled:opacity-60"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {intent && (
          <div className="font-caption text-caption text-on-surface-variant">
            Intent: <span className="font-bold">{intent.intent}</span>
            {intent.expandedTerms.length > 0 && ` · Expanded: ${intent.expandedTerms.join(", ")}`}
          </div>
        )}

        {results.map((r) => (
          <div key={r.post.id} className="flex flex-col gap-1">
            <span className="font-caption text-caption text-on-surface-variant self-end">
              score: {r.score.toFixed(3)}
            </span>
            <PostCard post={r.post} onToggleLike={handleToggleLike} />
          </div>
        ))}
      </div>
    </main>
  );
}
