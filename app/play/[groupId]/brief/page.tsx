"use client";

import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";
import { useGame } from "../../GameProvider";

export default function BriefPage() {
  const router = useRouter();
  const { challenge, gameState, session } = useGame();

  return (
    <>
      <div className="text-center space-y-2">
        <h1 className="font-display-lg text-headline-lg-mobile md:text-5xl text-primary drop-shadow-sm">
          Challenge Brief
        </h1>
        <p className="font-body-main text-body-main text-on-surface-variant max-w-2xl mx-auto">
          Review the parameters of your upcoming campaign before allocating tokens.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-stack-md">
        <section className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md md:col-span-8 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-leaf-light rounded-bl-full opacity-50 -z-0" />
          <div className="flex items-start gap-4 z-10">
            <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
              <MaterialIcon name="eco" className="text-3xl" />
            </div>
            <div>
              <h2 className="font-title-md text-title-md text-on-surface mb-1">
                Brand Profile: {challenge.brandName}
              </h2>
              <p className="text-on-surface-variant font-body-main text-body-main">
                {challenge.brandBackground}
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 z-10">
            <div className="bg-surface-container-low p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2 text-primary">
                <MaterialIcon name="flag" className="text-sm" />
                <span className="font-label-mono text-label-mono font-bold">Goal</span>
              </div>
              <p className="font-title-md text-lg text-on-surface">{challenge.goal}</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-xl">
              <div className="flex items-center gap-2 mb-2 text-primary">
                <MaterialIcon name="cloud" className="text-sm" />
                <span className="font-label-mono text-label-mono font-bold">Season</span>
              </div>
              <p className="font-title-md text-lg text-on-surface">{challenge.seasonalContext}</p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md md:col-span-4 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2 border-b border-outline-variant/30 pb-2">
            <MaterialIcon name="group" className="text-primary" />
            <h3 className="font-title-md text-title-md text-on-surface">Target Audience</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                <MaterialIcon name="cake" className="text-sm" />
              </div>
              <div>
                <p className="font-label-mono text-label-mono text-on-surface">Demographics</p>
                <p className="font-caption text-caption text-on-surface-variant">
                  {challenge.targetAudience.coreDemographics.join(", ")}
                </p>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                <MaterialIcon name="interests" className="text-sm" />
              </div>
              <div>
                <p className="font-label-mono text-label-mono text-on-surface">Core Interests</p>
                <p className="font-caption text-caption text-on-surface-variant">
                  {challenge.targetAudience.coreInterests.join(", ")}
                </p>
              </div>
            </li>
          </ul>
        </section>

        <section className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md md:col-span-12 flex flex-col md:flex-row justify-around items-center gap-6 text-center">
          <div className="flex flex-col items-center">
            <MaterialIcon name="savings" fill className="text-4xl text-token-gold mb-2" />
            <p className="font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider">
              Initial Budget
            </p>
            <p className="font-headline-lg text-headline-lg text-primary">
              {challenge.startingTokens.toLocaleString()} Tokens
            </p>
          </div>
          <div className="hidden md:block w-px h-16 bg-outline-variant/50" />
          <div className="flex flex-col items-center">
            <MaterialIcon name="autorenew" className="text-4xl text-secondary mb-2" />
            <p className="font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider">
              Total Rounds
            </p>
            <p className="font-headline-lg text-headline-lg text-on-surface">
              {challenge.totalRounds} Rounds
            </p>
          </div>
          <div className="hidden md:block w-px h-16 bg-outline-variant/50" />
          <div className="flex flex-col items-center">
            <MaterialIcon name="speed" className="text-4xl text-error mb-2" />
            <p className="font-label-mono text-label-mono text-on-surface-variant uppercase tracking-wider">
              Difficulty
            </p>
            <p className="font-headline-lg text-headline-lg text-on-surface capitalize">
              {challenge.difficulty}
            </p>
          </div>
        </section>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={() => router.push(`/play/${session.groupId}/compose`)}
          className="bg-primary text-on-primary font-title-md text-title-md px-8 py-4 rounded-xl shadow-md hover:shadow-lg hover:scale-95 transition-all active:scale-90 flex items-center gap-2 group"
        >
          Start Round {gameState.currentRound}
          <MaterialIcon
            name="arrow_forward"
            className="group-hover:translate-x-1 transition-transform"
          />
        </button>
      </div>
    </>
  );
}
