"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MaterialIcon } from "@/components/MaterialIcon";

interface StudentMe {
  id: string;
  email: string;
  displayName: string;
}

interface ChallengeCard {
  groupId: string;
  challengeId: string;
  brandName: string;
  challengeStatus: string;
  groupStatus: string;
  currentRound: number;
  totalRounds: number;
  finalScore: number | null;
}

export default function StudentPage() {
  const router = useRouter();
  const [me, setMe] = useState<StudentMe | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [challenges, setChallenges] = useState<ChallengeCard[] | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const loadChallenges = useCallback(async () => {
    const res = await fetch("/api/student/challenges");
    if (res.ok) {
      const data = await res.json();
      setChallenges(data.challenges);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          router.replace("/");
          return;
        }
        const data = await res.json();
        if (data.role !== "student") {
          router.replace("/");
          return;
        }
        setMe(data.student);
        setAuthChecked(true);
        await loadChallenges();
      })
      .catch(() => router.replace("/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    setJoining(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error ?? "Failed to join");
        return;
      }
      setJoinCode("");
      router.push(`/play/${data.groupId}/brief`);
    } catch {
      setJoinError("Network error, please try again");
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave(groupId: string) {
    await fetch(`/api/groups/${groupId}/leave`, { method: "POST" });
    await loadChallenges();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  if (!authChecked || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-label-mono text-label-mono text-on-surface-variant">Loading...</p>
      </div>
    );
  }

  return (
    <main className="bg-surface-bg text-on-surface min-h-screen font-body-main">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm flex justify-between items-center px-gutter-mobile py-base w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
            <MaterialIcon name="person" className="text-on-primary-container text-lg" />
          </div>
          <span className="font-title-md text-title-md text-primary">{me.displayName}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors"
        >
          <MaterialIcon name="logout" className="text-lg" />
          <span className="font-body-main text-sm">Log out</span>
        </button>
      </header>

      <div className="max-w-container-max mx-auto px-gutter-mobile py-stack-lg flex flex-col gap-stack-lg">
        <section className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <h2 className="font-title-md text-title-md mb-4 flex items-center gap-2">
            <MaterialIcon name="vpn_key" className="text-primary" />
            Join a Challenge
          </h2>
          <form onSubmit={handleJoin} className="flex gap-3">
            <input
              className="flex-1 px-4 py-3 bg-surface-bg border border-outline-variant rounded-xl font-label-mono text-label-mono tracking-[0.2em] text-center uppercase outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              maxLength={6}
              placeholder="XXXXXX"
              required
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button
              type="submit"
              disabled={joining}
              className="px-6 py-3 bg-primary text-on-primary rounded-xl font-title-md text-title-md disabled:opacity-60"
            >
              {joining ? "Joining..." : "Join"}
            </button>
          </form>
          {joinError && <p className="text-error text-caption font-caption mt-2">{joinError}</p>}
        </section>

        <section className="flex flex-col gap-stack-md">
          <h2 className="font-title-md text-title-md">My Challenges</h2>
          {challenges === null && (
            <p className="font-label-mono text-label-mono text-on-surface-variant">Loading...</p>
          )}
          {challenges?.length === 0 && (
            <div className="bg-white rounded-2xl border border-outline-variant/30 p-stack-lg text-center text-on-surface-variant">
              You haven&apos;t joined any challenges yet — enter a join code above.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
            {challenges?.map((c) => (
              <div
                key={c.groupId}
                className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md flex flex-col gap-3"
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-title-md text-title-md">{c.brandName}</h3>
                  <span className="font-caption text-caption px-2 py-1 rounded-full uppercase bg-surface-container-high text-on-surface-variant">
                    {c.groupStatus === "finished" ? "Finished" : `Round ${c.currentRound}/${c.totalRounds}`}
                  </span>
                </div>
                <div className="flex gap-3 mt-2">
                  <Link
                    href={`/play/${c.groupId}/brief`}
                    className="flex-1 text-center py-2.5 rounded-xl bg-primary text-on-primary font-body-main font-medium"
                  >
                    Continue
                  </Link>
                  <button
                    onClick={() => handleLeave(c.groupId)}
                    className="px-4 py-2.5 rounded-xl bg-surface-container-high text-error font-body-main font-medium"
                  >
                    Leave
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
