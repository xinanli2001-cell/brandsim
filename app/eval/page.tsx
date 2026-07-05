"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface StrategySummary {
  strategy: string;
  avgNdcg: number;
  avgMrr: number;
  avgPrecisionAt5: number;
  zeroResultRate: number;
}

interface BadCase {
  queryText: string;
  strategy: string;
  ndcg: number;
  precisionAt5: number;
  zeroResult: boolean;
  reason: string;
}

export default function EvalDashboardPage() {
  const [summary, setSummary] = useState<StrategySummary[]>([]);
  const [badCases, setBadCases] = useState<BadCase[]>([]);
  const [totalRuns, setTotalRuns] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/eval")
      .then((res) => res.json())
      .then((data) => {
        setSummary(data.summary ?? []);
        setBadCases(data.badCases ?? []);
        setTotalRuns(data.totalRuns ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const chartData = summary.map((s) => ({
    strategy: s.strategy,
    NDCG: Number(s.avgNdcg.toFixed(3)),
    MRR: Number(s.avgMrr.toFixed(3)),
    "Precision@5": Number(s.avgPrecisionAt5.toFixed(3)),
  }));

  return (
    <main className="bg-surface-bg text-on-surface min-h-screen font-body-main">
      <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-50 shadow-sm flex justify-between items-center px-gutter-mobile py-base w-full">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-extrabold text-primary">
          Search Eval Dashboard
        </h1>
        <Link href="/search" className="font-caption text-caption text-secondary hover:underline">
          ← Back to search
        </Link>
      </header>

      <div className="max-w-4xl mx-auto px-gutter-mobile py-stack-lg flex flex-col gap-stack-lg">
        {loading && (
          <p className="font-body-main text-body-main text-on-surface-variant text-center">Loading...</p>
        )}

        {!loading && totalRuns === 0 && (
          <p className="font-body-main text-body-main text-on-surface-variant text-center">
            No eval runs yet — run `npx tsx scripts/run-eval.ts` first.
          </p>
        )}

        {!loading && totalRuns > 0 && (
          <>
            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E2E8F0] p-stack-md">
              <h2 className="font-title-md text-title-md font-bold mb-stack-sm">
                Strategy comparison ({totalRuns} runs)
              </h2>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="strategy" />
                  <YAxis domain={[0, 1]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="NDCG" fill="#006e2f" />
                  <Bar dataKey="MRR" fill="#006591" />
                  <Bar dataKey="Precision@5" fill="#9e4036" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E2E8F0] p-stack-md overflow-x-auto">
              <h2 className="font-title-md text-title-md font-bold mb-stack-sm">Zero-result rate</h2>
              <table className="w-full text-left font-body-main text-body-main">
                <thead>
                  <tr className="text-on-surface-variant font-label-mono text-label-mono">
                    <th className="py-1">Strategy</th>
                    <th className="py-1">Zero-result rate</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => (
                    <tr key={s.strategy}>
                      <td className="py-1">{s.strategy}</td>
                      <td className="py-1">{(s.zeroResultRate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E2E8F0] p-stack-md overflow-x-auto">
              <h2 className="font-title-md text-title-md font-bold mb-stack-sm">
                Bad cases ({badCases.length})
              </h2>
              <table className="w-full text-left font-body-main text-body-main">
                <thead>
                  <tr className="text-on-surface-variant font-label-mono text-label-mono">
                    <th className="py-1">Query</th>
                    <th className="py-1">Strategy</th>
                    <th className="py-1">Reason</th>
                    <th className="py-1">NDCG</th>
                    <th className="py-1">P@5</th>
                  </tr>
                </thead>
                <tbody>
                  {badCases.map((b, i) => (
                    <tr key={`${b.queryText}-${b.strategy}-${i}`}>
                      <td className="py-1">{b.queryText}</td>
                      <td className="py-1">{b.strategy}</td>
                      <td className="py-1">{b.reason}</td>
                      <td className="py-1">{b.ndcg.toFixed(3)}</td>
                      <td className="py-1">{b.precisionAt5.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
