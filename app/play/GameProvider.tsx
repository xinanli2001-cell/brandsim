"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession, type ClientSession } from "@/lib/client/session";
import type { Challenge, GameState } from "@/lib/types";

interface GameContextValue {
  session: ClientSession;
  challenge: Challenge;
  gameState: GameState;
  refresh: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const s = loadSession();
    if (!s) {
      router.replace("/join");
      return;
    }
    setSession(s);
    const res = await fetch(`/api/game/${s.groupId}`);
    if (!res.ok) {
      setError("Group not found. Please join again.");
      return;
    }
    const data = await res.json();
    setChallenge(data.challenge);
    setGameState(data.gameState);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial mount fetch
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4 text-center px-6">
        <p className="font-body-main text-body-main text-on-surface-variant">{error}</p>
        <button
          className="bg-primary text-on-primary px-6 py-3 rounded-xl font-title-md text-title-md"
          onClick={() => router.replace("/join")}
        >
          Join Again
        </button>
      </div>
    );
  }

  if (!session || !challenge || !gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-label-mono text-label-mono text-on-surface-variant">Loading...</p>
      </div>
    );
  }

  return (
    <GameContext.Provider value={{ session, challenge, gameState, refresh }}>
      {children}
    </GameContext.Provider>
  );
}
