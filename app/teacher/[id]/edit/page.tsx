"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MaterialIcon } from "@/components/MaterialIcon";
import type { ActionKey, Difficulty } from "@/lib/types";

const ACTION_TOGGLES: Array<{ key: ActionKey; icon: string; label: string }> = [
  { key: "boost", icon: "campaign", label: "Post Boosting" },
  { key: "ad", icon: "ads_click", label: "Paid Ads" },
  { key: "audience", icon: "groups", label: "Audience Targeting" },
  { key: "influencer", icon: "star", label: "Influencer Partnerships" },
];

export default function EditChallengePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const [brandName, setBrandName] = useState("");
  const [backgroundDesc, setBackgroundDesc] = useState("");
  const [goal, setGoal] = useState("");
  const [demographics, setDemographics] = useState("");
  const [interests, setInterests] = useState("");
  const [seasonalContext, setSeasonalContext] = useState("");
  const [followerBase, setFollowerBase] = useState(1000);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [startingTokens, setStartingTokens] = useState(100);
  const [totalRounds, setTotalRounds] = useState(3);
  const [actions, setActions] = useState<ActionKey[]>(["boost", "ad", "audience", "influencer"]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/challenges/${params.id}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setLoadError(data.error ?? "Failed to load this challenge");
          return;
        }
        const data = await res.json();
        const c = data.challenge;
        setBrandName(c.brandName);
        setBackgroundDesc(c.brandBackground);
        setGoal(c.goal);
        setDemographics(c.targetAudience.coreDemographics.join(", "));
        setInterests(c.targetAudience.coreInterests.join(", "));
        setSeasonalContext(c.seasonalContext);
        setFollowerBase(c.followerBase);
        setDifficulty(c.difficulty);
        setStartingTokens(c.startingTokens);
        setTotalRounds(c.totalRounds);
        setActions(c.availableActions);
        setLeaderboardEnabled(c.leaderboardEnabled);
        setLocked(c.groupCount > 0);
      })
      .catch(() => setLoadError("Network error, please try again"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleAction(key: ActionKey) {
    if (locked) return;
    setActions((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));
  }

  const canSubmit =
    brandName.trim() && backgroundDesc.trim() && goal.trim() && seasonalContext.trim();

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/challenges/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          brandBackground: backgroundDesc,
          goal,
          targetAudience: {
            coreDemographics: demographics
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            coreInterests: interests
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          },
          seasonalContext,
          followerBase,
          totalRounds,
          startingTokens,
          difficulty,
          availableActions: actions,
          leaderboardEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      router.push(`/teacher/monitor/${params.id}`);
    } catch {
      setError("Network error, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="font-label-mono text-label-mono text-on-surface-variant">Loading...</p>;
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-16">
        <MaterialIcon name="lock" className="text-4xl text-on-surface-variant" />
        <p className="text-on-surface-variant">{loadError}</p>
        <button
          className="bg-primary text-on-primary px-6 py-3 rounded-xl font-title-md text-title-md"
          onClick={() => router.replace("/teacher")}
        >
          Back to My Campaigns
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-stack-lg pb-24 md:pb-0">
      <div className="flex justify-between items-end">
        <div>
          <Link
            href="/teacher"
            className="hover:text-primary transition-colors flex items-center gap-1 text-on-surface-variant mb-2"
          >
            <MaterialIcon name="arrow_back" className="text-[20px]" /> Back to Campaigns
          </Link>
          <h1 className="font-headline-lg text-headline-lg text-on-background">Edit Challenge</h1>
          <p className="font-body-main text-body-main text-on-surface-variant mt-2 max-w-2xl">
            {locked
              ? "Students have already joined — simulation parameters are locked. You can still update the brand narrative."
              : "Update the parameters for this marketing simulation scenario."}
          </p>
        </div>
        <div className="hidden md:flex gap-4">
          <button
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl bg-primary text-on-primary hover:scale-95 transition-transform duration-200 shadow-md font-body-main font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <MaterialIcon name="save" />
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error && <p className="text-error font-caption text-caption">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-stack-lg">
        <div className="md:col-span-8 space-y-stack-lg">
          <section className="bg-white rounded-2xl border border-[#E2E8F0] ambient-shadow p-stack-md md:p-stack-lg">
            <div className="mb-6 pb-4 border-b border-[#E2E8F0] flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-leaf-light flex items-center justify-center text-primary">
                <MaterialIcon name="storefront" />
              </div>
              <h2 className="font-title-md text-title-md text-on-background">Brand & Narrative</h2>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Brand Name <span className="text-error-rose">*</span>
                </label>
                <input
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors"
                  placeholder="e.g., EcoBrew Coffee"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Background Description <span className="text-error-rose">*</span>
                </label>
                <textarea
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors resize-none"
                  placeholder="Describe the market situation, brand history, and current challenges..."
                  rows={4}
                  maxLength={500}
                  value={backgroundDesc}
                  onChange={(e) => setBackgroundDesc(e.target.value)}
                />
                <p className="text-caption font-caption text-on-surface-variant mt-2 text-right">
                  {backgroundDesc.length} / 500 characters
                </p>
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Campaign Goal <span className="text-error-rose">*</span>
                </label>
                <input
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors"
                  placeholder="e.g., Maximize brand awareness and initial sales"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Seasonal Context <span className="text-error-rose">*</span>
                </label>
                <input
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors"
                  placeholder="e.g., Approaching Christmas, winter sales season"
                  value={seasonalContext}
                  onChange={(e) => setSeasonalContext(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Starting Follower Base
                </label>
                <input
                  type="number"
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors font-label-mono"
                  value={followerBase}
                  onChange={(e) => setFollowerBase(Number(e.target.value))}
                />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-[#E2E8F0] ambient-shadow p-stack-md md:p-stack-lg">
            <div className="mb-6 pb-4 border-b border-[#E2E8F0] flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary-container/30 flex items-center justify-center text-secondary">
                <MaterialIcon name="groups" />
              </div>
              <h2 className="font-title-md text-title-md text-on-background">Target Audience</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Demographics (comma separated)
                </label>
                <input
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors"
                  placeholder="Women 18-34, Families 25-44"
                  value={demographics}
                  onChange={(e) => setDemographics(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Core Interests (comma separated)
                </label>
                <input
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors"
                  placeholder="Sustainable Fashion, Handmade Goods"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                />
              </div>
            </div>
          </section>
        </div>

        <div className="md:col-span-4 space-y-stack-lg">
          <section className={`bg-white rounded-2xl border border-[#E2E8F0] ambient-shadow p-stack-md ${locked ? "opacity-60" : ""}`}>
            <h2 className="font-title-md text-title-md text-on-background mb-4">
              Simulation Parameters
            </h2>
            {locked && (
              <p className="font-caption text-caption text-on-surface-variant mb-4 flex items-center gap-1">
                <MaterialIcon name="lock" className="text-[16px]" /> Locked — students have joined
              </p>
            )}
            <div className="space-y-5">
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Difficulty Level
                </label>
                <div className="flex gap-2">
                  {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={locked}
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 py-2 rounded-lg border font-title-md text-[14px] capitalize disabled:cursor-not-allowed ${
                        difficulty === d
                          ? "border-primary bg-leaf-light text-primary"
                          : "border-outline-variant text-on-surface-variant hover:bg-surface-variant/30"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Starting Budget (Tokens)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-token-gold">
                    <MaterialIcon name="monetization_on" />
                  </span>
                  <input
                    type="number"
                    disabled={locked}
                    className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 pl-12 pr-4 transition-colors font-label-mono text-on-background disabled:cursor-not-allowed"
                    value={startingTokens}
                    onChange={(e) => setStartingTokens(Number(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Total Rounds
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  disabled={locked}
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors font-label-mono text-on-background disabled:cursor-not-allowed"
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(Number(e.target.value))}
                />
              </div>
            </div>
          </section>

          <section className={`bg-white rounded-2xl border border-[#E2E8F0] ambient-shadow p-stack-md ${locked ? "opacity-60" : ""}`}>
            <h2 className="font-title-md text-title-md text-on-background mb-4">
              Available Actions
            </h2>
            <p className="font-body-main text-[12px] text-on-surface-variant mb-4">
              Select which marketing levers students can pull.
            </p>
            <div className="space-y-4">
              {ACTION_TOGGLES.map((toggle) => (
                <label
                  key={toggle.key}
                  className={`flex items-center justify-between group ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-variant flex items-center justify-center text-on-surface-variant group-hover:bg-leaf-light group-hover:text-primary transition-colors">
                      <MaterialIcon name={toggle.icon} className="text-[18px]" />
                    </div>
                    <span className="font-title-md text-[14px] text-on-background">
                      {toggle.label}
                    </span>
                  </div>
                  <div
                    onClick={() => toggleAction(toggle.key)}
                    className={`w-11 h-6 rounded-full relative transition-colors ${locked ? "cursor-not-allowed" : "cursor-pointer"} ${
                      actions.includes(toggle.key) ? "bg-primary" : "bg-outline-variant"
                    }`}
                  >
                    <div
                      className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-all ${
                        actions.includes(toggle.key) ? "translate-x-full" : ""
                      }`}
                    />
                  </div>
                </label>
              ))}
              <label className={`flex items-center justify-between group pt-4 border-t border-outline-variant/30 ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}>
                <span className="font-title-md text-[14px] text-on-background">
                  Enable Leaderboard
                </span>
                <div
                  onClick={() => !locked && setLeaderboardEnabled((v) => !v)}
                  className={`w-11 h-6 rounded-full relative transition-colors ${locked ? "cursor-not-allowed" : "cursor-pointer"} ${
                    leaderboardEnabled ? "bg-primary" : "bg-outline-variant"
                  }`}
                >
                  <div
                    className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-all ${
                      leaderboardEnabled ? "translate-x-full" : ""
                    }`}
                  />
                </div>
              </label>
            </div>
          </section>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-outline-variant shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
        <button
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="w-full py-3 rounded-xl bg-primary text-on-primary font-title-md shadow-md active:scale-95 transition-transform disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
