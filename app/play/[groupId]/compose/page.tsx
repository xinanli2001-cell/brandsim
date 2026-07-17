"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useGame } from "../../GameProvider";
import type { Day, Influencer } from "@/lib/types";

const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_SLOTS = [
  { label: "Morning (08:00 - 12:00)", hour: 10 },
  { label: "Afternoon (12:00 - 17:00)", hour: 14 },
  { label: "Evening (17:00 - 21:00)", hour: 19 },
  { label: "Night (21:00 - 08:00)", hour: 22 },
];
const IMAGE_STYLES = [
  { key: "minimalist", label: "Minimalist" },
  { key: "retro", label: "Retro" },
  { key: "natural", label: "Natural" },
];

const AUDIENCE_COST_PER_TAG = 2;

export default function ComposePage() {
  const router = useRouter();
  const { challenge, gameState, session, refresh } = useGame();

  const [text, setText] = useState("");
  const [customHashtag, setCustomHashtag] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [imageStyle, setImageStyle] = useState("retro");
  const [day, setDay] = useState<Day>("Fri");
  const [hour, setHour] = useState(19);
  const [boostLevel, setBoostLevel] = useState(1);
  const [adSpend, setAdSpend] = useState(0);
  const [demographics, setDemographics] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [influencerId, setInfluencerId] = useState<string | null>(null);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/influencers")
      .then((r) => r.json())
      .then((d) => setInfluencers(d.influencers ?? []));
  }, []);

  const trendingHashtags = challenge.targetAudience.coreInterests.map(
    (i) => "#" + i.replace(/\s+/g, ""),
  );

  function toggleHashtag(tag: string) {
    setHashtags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function addCustomHashtag() {
    const tag = customHashtag.trim();
    if (!tag) return;
    const normalized = tag.startsWith("#") ? tag : "#" + tag;
    if (!hashtags.includes(normalized)) setHashtags((prev) => [...prev, normalized]);
    setCustomHashtag("");
  }

  function toggleDemographic(d: string) {
    setDemographics((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }
  function toggleInterest(i: string) {
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  const boostCost = boostLevel * 3;
  const adCost = adSpend;
  const audienceCost = (demographics.length + interests.length) * AUDIENCE_COST_PER_TAG;
  const selectedInfluencer = influencers.find((i) => i.id === influencerId) ?? null;
  const influencerCost = selectedInfluencer?.cost ?? 0;
  const totalCost = boostCost + adCost + audienceCost + influencerCost;
  const remaining = gameState.tokenBalance - totalCost;

  const canSubmit = text.trim().length > 0 && remaining >= 0 && !submitting;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: session.groupId,
          post: {
            id: `post_${session.groupId}_${gameState.currentRound}`,
            text,
            hashtags,
            hasImage: true,
            imageStyle,
            scheduledDay: day,
            scheduledHour: hour,
          },
          actions: {
            boost: boostLevel > 0 ? { level: boostLevel, cost: boostCost } : undefined,
            ad: adSpend > 0 ? { spend: adSpend, cost: adCost } : undefined,
            audience:
              demographics.length || interests.length
                ? { demographics, interests, cost: audienceCost }
                : undefined,
            influencer: influencerId ? { id: influencerId, cost: influencerCost } : undefined,
            totalCost,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to submit");
        return;
      }
      await refresh();
      router.push(`/play/${session.groupId}/dashboard`);
    } catch {
      setError("Network error, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  const audienceOptions = useMemo(
    () => ({
      demographics: challenge.targetAudience.coreDemographics,
      interests: challenge.targetAudience.coreInterests,
    }),
    [challenge],
  );

  return (
    <div className="flex flex-col gap-stack-lg w-full">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mb-2">
            Compose Campaign
          </h1>
          <p className="text-on-surface-variant">
            Craft your post, select actions, and estimate costs before publishing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-lg items-start relative">
        {/* Left: content */}
        <div className="lg:col-span-7 flex flex-col gap-stack-lg">
          <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-lg flex flex-col gap-6">
            <div className="flex justify-between items-center pb-4 border-b border-surface-variant">
              <h2 className="font-title-md text-title-md text-on-surface flex items-center gap-2">
                <MaterialIcon name="edit_square" className="text-primary" />
                Post Content
              </h2>
            </div>
            <div className="relative">
              <textarea
                className="w-full bg-surface-bg border border-outline-variant/50 rounded-xl p-4 min-h-[200px] font-body-main text-body-main text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none"
                placeholder="What's your marketing message?"
                maxLength={280}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="absolute bottom-4 right-4 font-caption text-caption text-on-surface-variant">
                {text.length}/280
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="font-label-mono text-label-mono text-on-surface-variant">
                Trending Hashtags
              </span>
              <div className="flex flex-wrap gap-2">
                {trendingHashtags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleHashtag(tag)}
                    className={`px-4 py-2 rounded-full font-caption text-caption transition-colors border ${
                      hashtags.includes(tag)
                        ? "bg-primary-container text-on-primary-container border-primary"
                        : "bg-surface-container border-outline-variant/50 text-on-surface hover:bg-leaf-light"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {hashtags
                  .filter((t) => !trendingHashtags.includes(t))
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleHashtag(tag)}
                      className="px-4 py-2 rounded-full bg-primary-container text-on-primary-container border border-primary font-caption text-caption"
                    >
                      {tag}
                    </button>
                  ))}
                <input
                  value={customHashtag}
                  onChange={(e) => setCustomHashtag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomHashtag())}
                  placeholder="+ Custom"
                  className="px-4 py-2 rounded-full bg-surface-container border border-outline-variant/50 font-caption text-caption text-on-surface w-28 outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <span className="font-label-mono text-label-mono text-on-surface-variant">
                Visual Style
              </span>
              <div className="grid grid-cols-3 gap-4">
                {IMAGE_STYLES.map((style) => (
                  <div
                    key={style.key}
                    className="cursor-pointer group"
                    onClick={() => setImageStyle(style.key)}
                  >
                    <div
                      className={`h-24 rounded-xl border-2 overflow-hidden mb-2 relative transition-all flex items-center justify-center bg-surface-container-low ${
                        imageStyle === style.key
                          ? "border-primary shadow-md shadow-primary/20"
                          : "border-transparent group-hover:border-primary/50"
                      }`}
                    >
                      <MaterialIcon name="image" className="text-on-surface-variant text-3xl" />
                      {imageStyle === style.key && (
                        <div className="absolute top-2 right-2 bg-primary text-on-primary rounded-full w-6 h-6 flex items-center justify-center">
                          <MaterialIcon name="check" className="text-[14px]" fill />
                        </div>
                      )}
                    </div>
                    <div
                      className={`text-center font-caption text-caption ${
                        imageStyle === style.key ? "text-primary font-bold" : "text-on-surface-variant"
                      }`}
                    >
                      {style.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-lg flex flex-col gap-6">
            <div className="flex justify-between items-center pb-4 border-b border-surface-variant">
              <h2 className="font-title-md text-title-md text-on-surface flex items-center gap-2">
                <MaterialIcon name="schedule" className="text-secondary" />
                Publish Timing
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-1">
                <label className="font-label-mono text-label-mono text-on-surface-variant mb-2 block">
                  Day of Week
                </label>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value as Day)}
                  className="w-full bg-surface-bg border border-outline-variant/50 rounded-xl p-4 font-body-main text-body-main text-on-surface focus:outline-none focus:border-primary"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="font-label-mono text-label-mono text-on-surface-variant mb-2 block">
                  Time Slot
                </label>
                <select
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="w-full bg-surface-bg border border-outline-variant/50 rounded-xl p-4 font-body-main text-body-main text-on-surface focus:outline-none focus:border-primary"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot.label} value={slot.hour}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="lg:col-span-5 flex flex-col gap-stack-lg lg:sticky lg:top-8">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden">
            <div className="bg-surface-container-low p-6 border-b border-surface-variant">
              <h2 className="font-title-md text-title-md text-on-surface flex items-center gap-2">
                <MaterialIcon name="tune" className="text-tertiary" />
                Action Panel
              </h2>
            </div>
            <div className="p-6 flex flex-col gap-8">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="font-label-mono text-label-mono text-on-surface text-[16px]">
                    Boost Intensity
                  </label>
                  <span className="font-label-mono text-label-mono text-token-gold flex items-center gap-1 text-[16px] font-bold">
                    {boostCost}
                    <MaterialIcon name="generating_tokens" className="text-[20px]" fill />
                  </span>
                </div>
                <input
                  className="w-full accent-primary h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer"
                  max={3}
                  min={0}
                  type="range"
                  value={boostLevel}
                  onChange={(e) => setBoostLevel(Number(e.target.value))}
                />
                <div className="flex justify-between mt-2 font-caption text-caption text-on-surface-variant">
                  <span>Organic</span>
                  <span>Viral push</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="font-label-mono text-label-mono text-on-surface text-[16px]">
                    Ad Spend
                  </label>
                  <span className="font-label-mono text-label-mono text-token-gold flex items-center gap-1 text-[16px] font-bold">
                    {adCost}
                    <MaterialIcon name="generating_tokens" className="text-[20px]" fill />
                  </span>
                </div>
                <input
                  className="w-full accent-primary h-2 bg-surface-variant rounded-lg appearance-none cursor-pointer"
                  max={50}
                  min={0}
                  step={5}
                  type="range"
                  value={adSpend}
                  onChange={(e) => setAdSpend(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="font-label-mono text-label-mono text-on-surface mb-3 block text-[16px]">
                  Target Audience ({AUDIENCE_COST_PER_TAG} each)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {audienceOptions.demographics.map((d) => (
                    <label
                      key={d}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container cursor-pointer border border-transparent hover:border-outline-variant/30 transition-all"
                    >
                      <input
                        type="checkbox"
                        checked={demographics.includes(d)}
                        onChange={() => toggleDemographic(d)}
                        className="text-primary rounded focus:ring-primary h-5 w-5 bg-surface-variant border-none"
                      />
                      <span className="font-caption text-caption text-[14px]">{d}</span>
                    </label>
                  ))}
                  {audienceOptions.interests.map((i) => (
                    <label
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-container cursor-pointer border border-transparent hover:border-outline-variant/30 transition-all"
                    >
                      <input
                        type="checkbox"
                        checked={interests.includes(i)}
                        onChange={() => toggleInterest(i)}
                        className="text-primary rounded focus:ring-primary h-5 w-5 bg-surface-variant border-none"
                      />
                      <span className="font-caption text-caption text-[14px]">{i}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-label-mono text-label-mono text-on-surface mb-3 block text-[16px]">
                  Collab Partner
                </label>
                <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
                  {influencers.map((inf) => {
                    const selected = influencerId === inf.id;
                    return (
                      <div
                        key={inf.id}
                        onClick={() => setInfluencerId(selected ? null : inf.id)}
                        className={`min-w-[160px] rounded-xl p-4 flex flex-col items-center gap-3 relative cursor-pointer transition-all ${
                          selected
                            ? "border-2 border-primary bg-leaf-light/30 shadow-md shadow-primary/10"
                            : "border border-outline-variant/50 bg-white hover:bg-surface-container"
                        }`}
                      >
                        {selected && (
                          <div className="absolute top-2 right-2 text-primary">
                            <MaterialIcon name="check_circle" className="text-[20px]" fill />
                          </div>
                        )}
                        <div className="w-16 h-16 rounded-full bg-surface-variant overflow-hidden flex items-center justify-center">
                          <MaterialIcon name="person" className="text-on-surface-variant text-3xl" />
                        </div>
                        <div className="text-center">
                          <div className="font-label-mono text-label-mono text-on-surface font-bold text-[14px] truncate">
                            {inf.name}
                          </div>
                          <div className="font-caption text-caption text-on-surface-variant text-[12px]">
                            {(inf.followers / 1000).toFixed(0)}K Reach
                          </div>
                        </div>
                        <div className="mt-auto pt-3 border-t border-outline-variant/30 w-full text-center">
                          <span className="font-label-mono text-label-mono text-token-gold flex items-center justify-center gap-1 text-[14px] font-bold">
                            {inf.cost}
                            <MaterialIcon name="generating_tokens" className="text-[16px]" fill />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-high rounded-2xl p-8 flex flex-col gap-6 shadow-lg border border-outline-variant/50">
            <div className="flex justify-between items-center">
              <span className="font-body-main text-body-main text-on-surface-variant text-[18px]">
                Estimated Cost
              </span>
              <div className="flex flex-col items-end">
                <span className="font-headline-lg text-headline-lg text-token-gold font-bold flex items-center gap-2">
                  {totalCost}
                  <MaterialIcon name="generating_tokens" className="text-[32px]" fill />
                </span>
                <span
                  className={`font-caption text-caption flex items-center gap-1 text-[14px] ${
                    remaining < 0 ? "text-error" : "text-primary"
                  }`}
                >
                  <MaterialIcon name="account_balance_wallet" className="text-[16px]" />
                  {remaining} remaining
                </span>
              </div>
            </div>
            {error && <p className="text-error text-caption font-caption">{error}</p>}
            <button
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="w-full py-4 bg-primary text-on-primary rounded-xl font-label-mono text-label-mono text-[16px] font-bold shadow-md hover:shadow-lg hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <MaterialIcon name="send" />
              {submitting ? "Publishing..." : "Publish & Evaluate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
