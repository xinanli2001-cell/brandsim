import type { Day, GameState } from "@/lib/types";

export interface ComposeDraft {
  text: string;
  hashtags: string[];
  imageStyle: string;
  day: Day;
  hour: number;
  boostLevel: number;
  adSpend: number;
  demographics: string[];
  interests: string[];
  influencerId: string | null;
}

export interface HistoryItem {
  round: number;
  text: string;
  hashtags: string[];
  imageStyle: string;
  scheduledDay: Day;
  scheduledHour: number;
  totalCost: number;
  reach: number;
  engagement: number;
  clicks: number;
  ctr: number;
  qualityCoefficient: number;
  feedback: string;
}

export function getInitialComposeDraft(gameState: GameState): ComposeDraft {
  const previous = gameState.history.at(-1)?.post;

  return {
    text: previous?.text ?? "",
    hashtags: previous?.hashtags ?? [],
    imageStyle: previous?.imageStyle ?? "retro",
    day: previous?.scheduledDay ?? "Fri",
    hour: previous?.scheduledHour ?? 19,
    boostLevel: 1,
    adSpend: 0,
    demographics: [],
    interests: [],
    influencerId: null,
  };
}

export function toHistoryItems(gameState: GameState): HistoryItem[] {
  return gameState.history.map(({ round, post, actions, result }) => ({
    round,
    text: post.text,
    hashtags: post.hashtags,
    imageStyle: post.imageStyle ?? "none",
    scheduledDay: post.scheduledDay,
    scheduledHour: post.scheduledHour,
    totalCost: actions.totalCost,
    reach: result.metrics.reach,
    engagement: result.metrics.engagement,
    clicks: result.metrics.clicks,
    ctr: result.metrics.ctr,
    qualityCoefficient: result.qualityCoefficient,
    feedback: result.feedback,
  }));
}
