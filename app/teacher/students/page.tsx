"use client";

import { useEffect, useMemo, useState } from "react";
import { MaterialIcon } from "@/components/MaterialIcon";

interface ChallengeSummary {
  id: string;
  brandName: string;
  joinCode: string;
  totalRounds: number;
  groupCount: number;
}

interface StudentProgress {
  groupId: string;
  studentId: string;
  displayName: string;
  email: string;
  tokenBalance: number;
  completedRounds: number;
  totalRounds: number;
  progressStatus: "not_started" | "in_progress" | "finished";
  currentRound: number;
  finalScore: number | null;
  latestReach: number | null;
  latestEngagement: number | null;
  lastActiveAt: string;
}

const STATUS_LABEL: Record<StudentProgress["progressStatus"], string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  finished: "Finished",
};

const STATUS_STYLE: Record<StudentProgress["progressStatus"], string> = {
  not_started: "bg-surface-variant text-on-surface-variant",
  in_progress: "bg-secondary-container/30 text-secondary",
  finished: "bg-primary-container text-on-primary-container",
};

export default function StudentProgressPage() {
  const [challenges, setChallenges] = useState<ChallengeSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/challenges")
      .then((res) => res.json())
      .then((data) => {
        const rows = data.challenges ?? [];
        setChallenges(rows);
        setSelectedId(rows[0]?.id ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    fetch(`/api/challenges/${selectedId}/students`)
      .then((res) => res.json())
      .then((data) => setStudents(data.students ?? []))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const selected = useMemo(
    () => challenges.find((challenge) => challenge.id === selectedId) ?? null,
    [challenges, selectedId],
  );
  const finished = students.filter((student) => student.progressStatus === "finished").length;
  const submittedRounds = students.reduce((sum, student) => sum + student.completedRounds, 0);
  const avgEngagement = students
    .map((student) => student.latestEngagement)
    .filter((value): value is number => value !== null);

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-background">
            Student Progress
          </h1>
          <p className="font-body-main text-body-main text-on-surface-variant mt-2">
            Select a challenge to review joined students, submitted rounds, tokens, and latest outcomes.
          </p>
        </div>
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="min-w-[280px] bg-white border border-outline-variant/40 rounded-xl px-4 py-3 font-body-main text-body-main text-on-surface focus:outline-none focus:border-primary"
        >
          {challenges.map((challenge) => (
            <option key={challenge.id} value={challenge.id}>
              {challenge.brandName} ({challenge.joinCode})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Students</span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2">
            {students.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Finished</span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2">
            {finished}/{students.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Rounds Posted</span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2">
            {submittedRounds}/{students.length * (selected?.totalRounds ?? 0)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Avg Engagement</span>
          <p className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mt-2">
            {avgEngagement.length
              ? Math.round(avgEngagement.reduce((sum, value) => sum + value, 0) / avgEngagement.length)
              : 0}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-title-md text-title-md text-on-surface flex items-center gap-2">
            <MaterialIcon name="groups" className="text-primary" />
            Challenge Roster
          </h2>
          {selected && (
            <span className="font-label-mono text-label-mono text-primary flex items-center gap-1">
              <MaterialIcon name="vpn_key" className="text-sm" />
              {selected.joinCode}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/30">
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant">Student</th>
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant">Progress</th>
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant">State</th>
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Tokens</th>
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Engagement</th>
                <th className="py-2 px-3 font-caption text-caption text-on-surface-variant text-right">Score</th>
              </tr>
            </thead>
            <tbody className="font-body-main text-body-main">
              {students.map((student) => (
                <tr key={student.groupId} className="border-b border-outline-variant/10">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-on-surface">{student.displayName}</div>
                    <div className="font-caption text-caption text-on-surface-variant">{student.email}</div>
                  </td>
                  <td className="py-3 px-3 font-label-mono text-label-mono">
                    Posted {student.completedRounds} / {student.totalRounds}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`font-caption text-caption px-2 py-1 rounded-full ${STATUS_STYLE[student.progressStatus]}`}>
                      {STATUS_LABEL[student.progressStatus]}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-label-mono text-label-mono">{student.tokenBalance}</td>
                  <td className="py-3 px-3 text-right font-label-mono text-label-mono">
                    {student.latestEngagement ?? "--"}
                  </td>
                  <td className="py-3 px-3 text-right font-label-mono text-label-mono">
                    {student.finalScore ?? "--"}
                  </td>
                </tr>
              ))}
              {!loading && students.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-on-surface-variant font-caption text-caption">
                    No active students for this challenge yet.
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
