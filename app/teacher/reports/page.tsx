"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/MaterialIcon";

interface Reports {
  overview: {
    totalChallenges: number;
    participantCount: number;
    completedGroups: number;
    completionRate: number;
    averageReach: number;
    averageEngagement: number;
    averageCtr: number;
  };
  challenges: Array<{
    challengeId: string;
    brandName: string;
    participantCount: number;
    completedGroups: number;
    completedRounds: number;
    totalRounds: number;
    completionRate: number;
    averageReach: number;
    averageEngagement: number;
    averageCtr: number;
    averageFinalScore: number | null;
  }>;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Reports | null>(null);

  useEffect(() => {
    fetch("/api/teacher/reports")
      .then((res) => res.json())
      .then((data) => setReports(data));
  }, []);

  if (!reports) {
    return <p className="font-label-mono text-label-mono text-on-surface-variant">Loading...</p>;
  }

  return (
    <div className="flex flex-col gap-stack-lg">
      <div>
        <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background">
          Reports
        </h1>
        <p className="font-body-main text-body-main text-on-surface-variant mt-2">
          Cross-challenge class performance, completion, reach, and engagement.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Challenges</span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2">
            {reports.overview.totalChallenges}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Students</span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2">
            {reports.overview.participantCount}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Avg Engagement</span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2">
            {reports.overview.averageEngagement}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Completion</span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2">
            {percent(reports.overview.completionRate)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
        <h2 className="font-title-md text-title-md text-on-surface flex items-center gap-2 mb-4">
          <MaterialIcon name="summarize" className="text-primary" />
          Challenge Performance
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30">
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant">Campaign</th>
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Students</th>
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Rounds</th>
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Complete</th>
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Reach</th>
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Engagement</th>
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">CTR</th>
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Score</th>
              </tr>
            </thead>
            <tbody className="font-body-main text-body-main">
              {reports.challenges.map((row) => (
                <tr key={row.challengeId} className="border-b border-outline-variant/10">
                  <td className="py-3 px-3 font-semibold">{row.brandName}</td>
                  <td className="py-3 px-3 text-right font-label-mono text-label-mono">{row.participantCount}</td>
                  <td className="py-3 px-3 text-right font-label-mono text-label-mono">
                    {row.completedRounds}/{row.participantCount * row.totalRounds}
                  </td>
                  <td className="py-3 px-3 text-right font-label-mono text-label-mono">
                    {percent(row.completionRate)}
                  </td>
                  <td className="py-3 px-3 text-right font-label-mono text-label-mono">
                    {row.averageReach.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-label-mono text-label-mono">
                    {row.averageEngagement.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-label-mono text-label-mono">
                    {percent(row.averageCtr)}
                  </td>
                  <td className="py-3 px-3 text-right font-label-mono text-label-mono">
                    {row.averageFinalScore ?? "--"}
                  </td>
                </tr>
              ))}
              {reports.challenges.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-on-surface-variant font-caption text-caption">
                    No report data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
