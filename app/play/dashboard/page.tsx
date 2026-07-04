"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useGame } from "../GameProvider";

function MetricCard({
  label,
  value,
  icon,
  iconColor,
}: {
  label: string;
  value: string;
  icon: string;
  iconColor: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-stack-md ambient-shadow flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">
          {label}
        </span>
        <MaterialIcon name={icon} className={iconColor} />
      </div>
      <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface">
        {value}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { gameState } = useGame();

  const latest = gameState.history[gameState.history.length - 1];

  useEffect(() => {
    if (gameState.status === "finished") {
      router.replace("/play/result");
    } else if (!latest) {
      router.replace("/play/compose");
    }
  }, [gameState.status, latest, router]);

  if (!latest || gameState.status === "finished") return null;

  const { result } = latest;
  const chartData = result.timeSeries.byHour.map((h) => ({
    hour: `${h.hour}:00`,
    engagement: h.engagement,
  }));

  return (
    <div className="flex flex-col gap-stack-lg" id="feed">
      <div className="flex flex-col gap-2">
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary font-bold">
          Campaign Evaluation
        </h2>
        <p className="text-on-surface-variant">
          Review the performance of round {result.round}.
        </p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Impressions"
          value={result.metrics.impressions.toLocaleString()}
          icon="visibility"
          iconColor="text-secondary-container"
        />
        <MetricCard
          label="Reach"
          value={result.metrics.reach.toLocaleString()}
          icon="groups"
          iconColor="text-tertiary-container"
        />
        <MetricCard
          label="Clicks"
          value={result.metrics.clicks.toLocaleString()}
          icon="touch_app"
          iconColor="text-primary-container"
        />
        <MetricCard
          label="CTR"
          value={`${(result.metrics.ctr * 100).toFixed(1)}%`}
          icon="ads_click"
          iconColor="text-secondary"
        />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-lg">
        <div className="md:col-span-2 glass-card rounded-2xl p-stack-md ambient-shadow">
          <h3 className="font-title-md text-title-md mb-4 text-on-surface">
            Engagement Over Time
          </h3>
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#e2ebde" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="engagement"
                  name="Interactions"
                  stroke="#006e2f"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-stack-md ambient-shadow flex flex-col">
          <h3 className="font-title-md text-title-md mb-4 text-on-surface">
            Performance Factors
          </h3>
          <ul className="flex flex-col gap-3 flex-grow">
            {result.breakdown.map((b) => {
              const positive = b.effect.startsWith("+");
              return (
                <li
                  key={b.factor}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    positive
                      ? "bg-surface-container-low border-leaf-light"
                      : "bg-error-container border-error/20 text-on-error-container"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-body-main text-sm">{b.factor}</span>
                    <span className="font-caption text-caption text-on-surface-variant">
                      {b.note}
                    </span>
                  </div>
                  <span className={`font-bold ${positive ? "text-primary" : "text-error"}`}>
                    {b.effect}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 p-4 bg-secondary-container/20 rounded-xl">
            <h4 className="font-label-mono text-label-mono text-secondary font-bold mb-1 flex items-center gap-1">
              <MaterialIcon name="smart_toy" className="text-sm" /> AI Feedback
            </h4>
            <p className="font-caption text-caption text-on-surface-variant">{result.feedback}</p>
          </div>
        </div>
      </div>

      <section className="glass-card rounded-2xl p-stack-md ambient-shadow">
        <h3 className="font-title-md text-title-md mb-4 text-on-surface flex items-center gap-2">
          <MaterialIcon name="forum" /> Simulated Engagement Feed
        </h3>
        <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-2">
          {result.visibleEngagement.map((e, i) => (
            <div key={i} className="flex gap-3 items-start bg-surface-bg p-3 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-secondary-fixed flex-shrink-0 flex items-center justify-center font-bold text-on-secondary-fixed">
                {e.user
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm">{e.user}</span>
                  <span className="font-caption text-caption text-outline capitalize">
                    {e.type}
                  </span>
                </div>
                {e.text && <p className="text-sm mt-1">{e.text}</p>}
                {typeof e.likes === "number" && (
                  <div className="flex gap-4 mt-2 text-outline text-xs">
                    <span className="flex items-center gap-1">
                      <MaterialIcon name="favorite" className="text-[14px]" /> {e.likes}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end mt-4 pb-8">
        <button
          onClick={() => router.push("/play/compose")}
          className="bg-primary text-on-primary px-8 py-3 rounded-full font-bold shadow-lg hover:scale-95 active:scale-90 transition-all flex items-center gap-2"
        >
          Enter Next Round
          <MaterialIcon name="arrow_forward" />
        </button>
      </div>
    </div>
  );
}
