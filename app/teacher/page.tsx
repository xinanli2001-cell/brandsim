"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/MaterialIcon";

interface ChallengeSummary {
  id: string;
  brandName: string;
  joinCode: string;
  status: string;
  totalRounds: number;
  startingTokens: number;
  createdAt: string;
  groupCount: number;
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary-container text-on-primary-container",
  paused: "bg-tertiary-container text-on-tertiary-container",
  ended: "bg-surface-variant text-on-surface-variant",
};

export default function TeacherDashboardPage() {
  const [challenges, setChallenges] = useState<ChallengeSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/challenges")
      .then((r) => r.json())
      .then((d) => setChallenges(d.challenges ?? []));
  }, []);

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-background">My Campaigns</h1>
          <p className="font-body-main text-body-main text-on-surface-variant mt-2">
            Create and manage your marketing simulation challenges.
          </p>
        </div>
        <Link
          href="/teacher/new"
          className="hidden md:flex px-6 py-2.5 rounded-xl bg-primary text-on-primary hover:scale-95 transition-transform duration-200 shadow-md font-body-main font-medium items-center gap-2"
        >
          <MaterialIcon name="add" />
          New Challenge
        </Link>
      </div>

      {challenges === null && (
        <p className="font-label-mono text-label-mono text-on-surface-variant">Loading...</p>
      )}

      {challenges?.length === 0 && (
        <div className="bg-white rounded-2xl border border-outline-variant/30 p-stack-lg text-center flex flex-col items-center gap-4">
          <MaterialIcon name="campaign" className="text-4xl text-on-surface-variant" />
          <p className="text-on-surface-variant">No challenges yet — click the button above to create your first one.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-md">
        {challenges?.map((c) => (
          <Link
            key={c.id}
            href={`/teacher/monitor/${c.id}`}
            className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md flex flex-col gap-3 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start">
              <h3 className="font-title-md text-title-md text-on-surface">{c.brandName}</h3>
              <span
                className={`font-caption text-caption px-2 py-1 rounded-full uppercase ${STATUS_STYLE[c.status]}`}
              >
                {c.status}
              </span>
            </div>
            <div className="flex items-center gap-2 font-label-mono text-label-mono text-primary">
              <MaterialIcon name="vpn_key" className="text-sm" />
              {c.joinCode}
            </div>
            <div className="flex justify-between text-caption font-caption text-on-surface-variant mt-2">
              <span className="flex items-center gap-1">
                <MaterialIcon name="group" className="text-sm" /> {c.groupCount} groups
              </span>
              <span className="flex items-center gap-1">
                <MaterialIcon name="autorenew" className="text-sm" /> {c.totalRounds} rounds
              </span>
            </div>
          </Link>
        ))}
      </div>

      <Link
        href="/teacher/new"
        className="md:hidden fixed bottom-6 right-6 bg-primary text-on-primary rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
      >
        <MaterialIcon name="add" className="text-2xl" />
      </Link>
    </div>
  );
}
