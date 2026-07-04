"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useGame } from "../GameProvider";
import type { LeaderboardEntry } from "@/lib/types";

export default function ResultPage() {
  const { challenge, gameState, session } = useGame();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    fetch(`/api/leaderboard/${challenge.id}?groupId=${session.groupId}`)
      .then((r) => r.json())
      .then((d) => setEntries(d.entries ?? []));
  }, [challenge.id, session.groupId]);

  const you = entries.find((e) => e.isYou);
  const rank = entries.findIndex((e) => e.isYou) + 1;

  const trendData = gameState.history.map((h) => ({
    round: `R${h.round}`,
    engagement: h.result.metrics.engagement,
  }));

  const first = gameState.history[0]?.result.metrics.engagement ?? 0;
  const last = gameState.history[gameState.history.length - 1]?.result.metrics.engagement ?? 0;
  const improvementPct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

  return (
    <main className="flex-1 max-w-container-max mx-auto w-full relative">
      <div className="mb-10 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-container text-on-primary-container rounded-full mb-2 shadow-lg relative">
          <MaterialIcon name="emoji_events" className="text-4xl" fill />
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-token-gold rounded-full border-2 border-surface flex items-center justify-center">
            <MaterialIcon name="star" className="text-on-primary text-sm" fill />
          </div>
        </div>
        <h1 className="font-display-lg text-headline-lg-mobile md:text-display-lg text-primary">
          Simulation Complete!
        </h1>
        <p className="font-body-main text-body-main text-on-surface-variant max-w-lg mx-auto">
          Great job navigating the market dynamics, {session.groupName}. Here&apos;s how your
          campaign performed across all {gameState.totalRounds} rounds.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-stack-md md:gap-stack-lg">
        <div className="md:col-span-4 glass-card rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex flex-col justify-between">
          <div>
            <h3 className="font-title-md text-title-md text-on-surface-variant mb-2 flex items-center gap-2">
              <MaterialIcon name="analytics" className="text-primary" /> Final Score
            </h3>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-display-lg text-primary">
                {you?.finalScore ?? "--"}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-primary-container">
              <MaterialIcon name="trending_up" className="text-sm" />
              <span className="font-label-mono text-label-mono">
                {improvementPct >= 0 ? "+" : ""}
                {improvementPct}% from Round 1
              </span>
            </div>
          </div>
          {rank > 0 && (
            <div className="mt-8 pt-4 border-t border-outline-variant/30">
              <div className="flex justify-between items-center">
                <span className="font-caption text-caption text-on-surface-variant">
                  Class Rank
                </span>
                <span className="font-label-mono text-label-mono text-on-surface font-semibold">
                  #{rank} / {entries.length}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-8 glass-card rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <h3 className="font-title-md text-title-md text-on-surface-variant mb-6 flex items-center gap-2">
            <MaterialIcon name="show_chart" className="text-secondary" /> Progress Trend
          </h3>
          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#bccbb9" strokeDasharray="2 2" vertical={false} />
                <XAxis dataKey="round" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="#006e2f"
                  strokeWidth={2}
                  fill="url(#grad1)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="md:col-span-12 glass-card rounded-2xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.04)] mt-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-title-md text-title-md text-on-surface font-bold">
              Global Leaderboard
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30">
                  <th className="py-3 px-4 font-caption text-caption text-on-surface-variant font-medium">
                    Rank
                  </th>
                  <th className="py-3 px-4 font-caption text-caption text-on-surface-variant font-medium">
                    Team
                  </th>
                  <th className="py-3 px-4 font-caption text-caption text-on-surface-variant font-medium text-right">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody className="font-body-main text-body-main">
                {entries.map((e, i) => (
                  <tr
                    key={e.groupName}
                    className={
                      e.isYou
                        ? "border-b-2 border-primary bg-leaf-light/30"
                        : "border-b border-outline-variant/10 hover:bg-surface-container-low transition-colors"
                    }
                  >
                    <td className="py-4 px-4">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold font-label-mono ${
                          i === 0
                            ? "bg-token-gold/20 text-token-gold"
                            : "bg-surface-variant text-on-surface-variant"
                        }`}
                      >
                        {i + 1}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                            e.isYou
                              ? "bg-primary text-on-primary"
                              : "bg-secondary-container text-on-secondary-container"
                          }`}
                        >
                          {e.groupName[0]}
                        </div>
                        <div>
                          <div className={e.isYou ? "font-bold text-primary flex items-center gap-2" : "font-semibold text-on-surface"}>
                            {e.groupName}
                            {e.isYou && (
                              <span className="bg-primary text-on-primary text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">
                                You
                              </span>
                            )}
                          </div>
                          <div className="font-caption text-caption text-on-surface-variant">
                            {e.bestMetric}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-label-mono font-semibold">
                      {e.finalScore.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
