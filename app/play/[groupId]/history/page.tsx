"use client";

import Link from "next/link";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useGame } from "../../GameProvider";
import { toHistoryItems } from "@/lib/play/compose-history";

function formatTime(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export default function HistoryPage() {
  const { gameState, session } = useGame();
  const history = toHistoryItems(gameState);

  return (
    <div className="flex flex-col gap-stack-lg w-full">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mb-2">
            Round History
          </h1>
          <p className="text-on-surface-variant">
            Review previous posts, spend choices, and performance feedback.
          </p>
        </div>
        <Link
          href={`/play/${session.groupId}/compose`}
          className="px-4 py-2 rounded-xl bg-primary text-on-primary font-body-main font-medium flex items-center gap-2"
        >
          <MaterialIcon name="edit_square" />
          Compose
        </Link>
      </div>

      {history.length === 0 && (
        <div className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-lg text-center flex flex-col items-center gap-4">
          <MaterialIcon name="history" className="text-4xl text-on-surface-variant" />
          <p className="text-on-surface-variant">No submitted rounds yet.</p>
        </div>
      )}

      <div className="flex flex-col gap-stack-md">
        {history.map((item) => (
          <article
            key={item.round}
            className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md flex flex-col gap-5"
          >
            <div className="flex flex-wrap justify-between gap-3 pb-4 border-b border-outline-variant/20">
              <div>
                <h2 className="font-title-md text-title-md text-on-surface">Round {item.round}</h2>
                <p className="font-caption text-caption text-on-surface-variant">
                  {item.scheduledDay} at {formatTime(item.scheduledHour)} · {item.imageStyle} image style
                </p>
              </div>
              <span className="font-label-mono text-label-mono text-token-gold flex items-center gap-1">
                {item.totalCost}
                <MaterialIcon name="generating_tokens" className="text-[18px]" fill />
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <p className="font-body-main text-body-main text-on-surface whitespace-pre-wrap">{item.text}</p>
              <div className="flex flex-wrap gap-2">
                {item.hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-caption text-caption"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-surface-container-low rounded-xl p-3">
                <span className="font-caption text-caption text-on-surface-variant">Reach</span>
                <p className="font-title-md text-title-md text-on-surface">{item.reach.toLocaleString()}</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3">
                <span className="font-caption text-caption text-on-surface-variant">Engagement</span>
                <p className="font-title-md text-title-md text-on-surface">{item.engagement.toLocaleString()}</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3">
                <span className="font-caption text-caption text-on-surface-variant">Clicks</span>
                <p className="font-title-md text-title-md text-on-surface">{item.clicks.toLocaleString()}</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3">
                <span className="font-caption text-caption text-on-surface-variant">CTR</span>
                <p className="font-title-md text-title-md text-on-surface">{Math.round(item.ctr * 100)}%</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3">
                <span className="font-caption text-caption text-on-surface-variant">Quality</span>
                <p className="font-title-md text-title-md text-on-surface">{item.qualityCoefficient.toFixed(2)}</p>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4">
              <span className="font-label-mono text-label-mono text-on-surface-variant uppercase">Feedback</span>
              <p className="font-body-main text-body-main text-on-surface mt-2">{item.feedback}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
