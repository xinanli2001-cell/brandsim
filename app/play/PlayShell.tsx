"use client";

import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { useGame } from "./GameProvider";

export function PlayShell({ children }: { children: React.ReactNode }) {
  const { gameState } = useGame();

  return (
    <div className="min-h-screen pb-24 font-body-main text-on-surface">
      <TopBar tokenBalance={gameState.tokenBalance} />
      <main className="px-gutter-mobile md:px-gutter-desktop max-w-container-max mx-auto py-stack-lg flex flex-col gap-stack-lg">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
