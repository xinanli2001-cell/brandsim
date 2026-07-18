"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";

interface GroupRow {
  id: string;
  groupName: string;
  tokenBalance: number;
  currentRound: number;
  status: string;
  finalScore: number | null;
  latestReach: number | null;
  latestEngagement: number | null;
  lastActiveAt: string;
}

interface ChallengeDetail {
  id: string;
  status: string;
  brandName: string;
  joinCode: string;
  totalRounds: number;
  startingTokens: number;
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary-container text-on-primary-container",
  paused: "bg-tertiary-container text-on-tertiary-container",
  ended: "bg-surface-variant text-on-surface-variant",
};

export default function TeacherMonitorPage() {
  const params = useParams<{ challengeId: string }>();
  const router = useRouter();
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/challenges/${params.challengeId}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to load this challenge");
      return;
    }
    const data = await res.json();
    setChallenge(data.challenge);
    setGroups(data.groups);
  }, [params.challengeId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial mount fetch + polling
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  async function setStatus(status: "active" | "paused" | "ended") {
    await fetch(`/api/challenges/${params.challengeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Permanently delete "${challenge?.brandName}"? This also deletes every student's data for it. This cannot be undone.`,
      )
    ) {
      return;
    }
    await fetch(`/api/challenges/${params.challengeId}`, { method: "DELETE" });
    router.replace("/teacher");
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-16">
        <MaterialIcon name="lock" className="text-4xl text-on-surface-variant" />
        <p className="text-on-surface-variant">{error}</p>
        <button
          className="bg-primary text-on-primary px-6 py-3 rounded-xl font-title-md text-title-md"
          onClick={() => router.replace("/teacher")}
        >
          Back to My Campaigns
        </button>
      </div>
    );
  }

  if (!challenge) {
    return <p className="font-label-mono text-label-mono text-on-surface-variant">Loading...</p>;
  }

  const activeGroups = groups.filter((g) => g.status === "in_progress").length;
  const engagementValues = groups.map((g) => g.latestEngagement).filter((v): v is number => v != null);
  const avgEngagement = engagementValues.length
    ? Math.round(engagementValues.reduce((a, b) => a + b, 0) / engagementValues.length)
    : 0;
  const avgTokenUsage = groups.length
    ? Math.round(
        (groups.reduce((sum, g) => sum + (1 - g.tokenBalance / challenge.startingTokens), 0) /
          groups.length) *
          100,
      )
    : 0;

  const leaderboardTrend = [...groups]
    .sort((a, b) => (b.finalScore ?? b.latestEngagement ?? 0) - (a.finalScore ?? a.latestEngagement ?? 0))
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background">
            Class Monitor
          </h1>
          <p className="font-body-main text-body-main text-on-surface-variant">
            Real-time progress for &quot;{challenge.brandName}&quot;
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-xl">
            <MaterialIcon name="vpn_key" className="text-primary" />
            <span className="font-label-mono text-label-mono font-bold">{challenge.joinCode}</span>
          </div>
          <span className={`font-caption text-caption px-3 py-1.5 rounded-full uppercase ${STATUS_STYLE[challenge.status]}`}>
            {challenge.status}
          </span>
          <button
            onClick={() => router.push(`/teacher/${params.challengeId}/edit`)}
            className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-body-main font-medium flex items-center gap-2"
          >
            <MaterialIcon name="edit" />
            Edit
          </button>
          {challenge.status !== "ended" && (
            <>
              <button
                onClick={() => setStatus(challenge.status === "paused" ? "active" : "paused")}
                className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-body-main font-medium flex items-center gap-2"
              >
                <MaterialIcon name={challenge.status === "paused" ? "play_arrow" : "pause"} />
                {challenge.status === "paused" ? "Resume" : "Pause"}
              </button>
              <button
                onClick={() => setStatus("ended")}
                className="px-4 py-2 rounded-xl bg-error text-on-error font-body-main font-medium flex items-center gap-2"
              >
                <MaterialIcon name="stop_circle" />
                End Challenge
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            className="px-4 py-2 rounded-xl bg-error-container text-on-error-container font-body-main font-medium flex items-center gap-2"
          >
            <MaterialIcon name="delete" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">
            Avg Engagement
          </span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2">
            {avgEngagement.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">
            Active Teams
          </span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2">
            {activeGroups}/{groups.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">
            Avg Token Usage
          </span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2">
            {avgTokenUsage}%
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">
            Total Rounds
          </span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2">
            {challenge.totalRounds}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-lg">
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <h3 className="font-title-md text-title-md mb-4 flex items-center gap-2">
            <MaterialIcon name="leaderboard" /> Leaderboard Trend
          </h3>
          <div className="flex flex-col gap-3">
            {leaderboardTrend.length === 0 && (
              <p className="font-caption text-caption text-on-surface-variant">No data yet</p>
            )}
            {leaderboardTrend.map((g, i) => (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      i === 0 ? "bg-token-gold text-white" : "bg-surface-variant text-on-surface-variant"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className="font-body-main font-semibold">{g.groupName}</span>
                </div>
                <span className="font-label-mono text-label-mono text-primary">
                  {g.finalScore ?? g.latestEngagement ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-title-md text-title-md flex items-center gap-2">
              <MaterialIcon name="groups" /> Live Team Status
            </h3>
            <span className="flex items-center gap-1 font-caption text-caption text-primary">
              <span className="w-2 h-2 rounded-full bg-primary inline-block" /> Live Updates
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30">
                  <th className="py-2 px-3 font-caption text-caption text-on-surface-variant">Team</th>
                  <th className="py-2 px-3 font-caption text-caption text-on-surface-variant">Round</th>
                  <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Reach</th>
                  <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Tokens Left</th>
                  <th className="py-2 px-3 font-caption text-caption text-on-surface-variant">Status</th>
                </tr>
              </thead>
              <tbody className="font-body-main text-body-main">
                {groups.map((g) => (
                  <tr key={g.id} className="border-b border-outline-variant/10">
                    <td className="py-3 px-3 font-semibold">{g.groupName}</td>
                    <td className="py-3 px-3 font-label-mono">
                      {g.currentRound}/{challenge.totalRounds}
                    </td>
                    <td className="py-3 px-3 text-right font-label-mono">
                      {g.latestReach?.toLocaleString() ?? "--"}
                    </td>
                    <td className="py-3 px-3 text-right font-label-mono">{g.tokenBalance}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-caption text-caption px-2 py-1 rounded-full ${
                          g.status === "finished"
                            ? "bg-primary-container text-on-primary-container"
                            : "bg-secondary-container/30 text-secondary"
                        }`}
                      >
                        {g.status === "finished" ? "Finished" : "In Progress"}
                      </span>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-on-surface-variant font-caption text-caption">
                      No students have joined yet — share join code {challenge.joinCode} with your class.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
