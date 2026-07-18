"use client";

import { useEffect, useMemo, useState } from "react";
import { MaterialIcon } from "@/components/MaterialIcon";

type ActionKey = "boost" | "ad" | "audience" | "influencer";

interface Economy {
  totalSpent: number;
  actionTotals: Record<ActionKey, number>;
  actionUses: Record<ActionKey, number>;
  mostUsedAction: { action: ActionKey; uses: number; spent: number } | null;
  byChallenge: Array<{
    challengeId: string;
    brandName: string;
    participantCount: number;
    roundsSubmitted: number;
    totalSpent: number;
    actionTotals: Record<ActionKey, number>;
  }>;
}

const ACTION_LABEL: Record<ActionKey, string> = {
  boost: "Boost",
  ad: "Ad Spend",
  audience: "Audience",
  influencer: "Influencer",
};

const ACTION_ICON: Record<ActionKey, string> = {
  boost: "rocket_launch",
  ad: "ads_click",
  audience: "target",
  influencer: "diversity_1",
};

export default function TokenEconomyPage() {
  const [economy, setEconomy] = useState<Economy | null>(null);

  useEffect(() => {
    fetch("/api/teacher/token-economy")
      .then((res) => res.json())
      .then((data) => setEconomy(data));
  }, []);

  const maxActionSpend = useMemo(() => {
    if (!economy) return 0;
    return Math.max(1, ...Object.values(economy.actionTotals));
  }, [economy]);

  if (!economy) {
    return <p className="font-label-mono text-label-mono text-on-surface-variant">Loading...</p>;
  }

  return (
    <div className="flex flex-col gap-stack-lg">
      <div>
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background">
          Token Economy
        </h1>
        <p className="font-body-main text-body-main text-on-surface-variant mt-2">
          Cross-challenge token spend by action type, class activity, and campaign.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Total Spent</span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-token-gold mt-2 flex items-center gap-2">
            {economy.totalSpent}
            <MaterialIcon name="generating_tokens" fill />
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Most Used</span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2 capitalize">
            {economy.mostUsedAction ? ACTION_LABEL[economy.mostUsedAction.action] : "None"}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Submitted Rounds</span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2">
            {economy.byChallenge.reduce((sum, row) => sum + row.roundsSubmitted, 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-stack-lg">
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <h2 className="font-title-md text-title-md text-on-surface flex items-center gap-2 mb-5">
            <MaterialIcon name="database" className="text-primary" />
            Spend by Action
          </h2>
          <div className="flex flex-col gap-4">
            {(Object.keys(ACTION_LABEL) as ActionKey[]).map((action) => {
              const value = economy.actionTotals[action];
              const width = `${Math.max(4, (value / maxActionSpend) * 100)}%`;
              return (
                <div key={action} className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-body-main text-body-main text-on-surface flex items-center gap-2">
                      <MaterialIcon name={ACTION_ICON[action]} className="text-primary" />
                      {ACTION_LABEL[action]}
                    </span>
                    <span className="font-label-mono text-label-mono text-token-gold">{value}</span>
                  </div>
                  <div className="h-3 bg-surface-container-high rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <h2 className="font-title-md text-title-md text-on-surface flex items-center gap-2 mb-5">
            <MaterialIcon name="table_chart" className="text-secondary" />
            Campaign Detail
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30">
                  <th className="py-2 px-3 font-caption text-caption text-on-surface-variant">Campaign</th>
                  <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Students</th>
                  <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Rounds</th>
                  <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Spent</th>
                </tr>
              </thead>
              <tbody className="font-body-main text-body-main">
                {economy.byChallenge.map((row) => (
                  <tr key={row.challengeId} className="border-b border-outline-variant/10">
                    <td className="py-3 px-3 font-semibold">{row.brandName}</td>
                    <td className="py-3 px-3 text-right font-label-mono text-label-mono">{row.participantCount}</td>
                    <td className="py-3 px-3 text-right font-label-mono text-label-mono">{row.roundsSubmitted}</td>
                    <td className="py-3 px-3 text-right font-label-mono text-label-mono text-token-gold">
                      {row.totalSpent}
                    </td>
                  </tr>
                ))}
                {economy.byChallenge.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-on-surface-variant font-caption text-caption">
                      No token spend yet.
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
