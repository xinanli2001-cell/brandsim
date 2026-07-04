// 唯一真相来源：与 docs/data-contract.md 对齐。前端(Gemini 皮)与后端共用这些形状。

export type Demographic = string;
export type Interest = string;
export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type Difficulty = "easy" | "normal" | "hard";
export type ActionKey = "boost" | "ad" | "audience" | "influencer";

export interface Challenge {
  id: string;
  brandName: string;
  brandBackground: string;
  goal: string;
  targetAudience: { coreDemographics: Demographic[]; coreInterests: Interest[] };
  seasonalContext: string;
  followerBase: number;
  totalRounds: number;
  startingTokens: number;
  difficulty: Difficulty;
  availableActions: ActionKey[];
  leaderboardEnabled: boolean;
}

export interface Influencer {
  id: string;
  name: string;
  followers: number;
  audienceMatch: number; // 0..1 与目标受众契合度
  niche: string[];
  cost: number;
}

export interface Post {
  id: string;
  challengeId: string;
  round: number;
  text: string;
  hashtags: string[];
  hasImage: boolean;
  imageStyle?: string;
  scheduledDay: Day;
  scheduledHour: number; // 0..23
}

export interface ActionSelection {
  round: number;
  boost?: { level: number; cost: number };
  ad?: { spend: number; cost: number };
  audience?: { demographics: Demographic[]; interests: Interest[]; cost: number };
  influencer?: { id: string; cost: number };
  totalCost: number;
}

export interface Metrics {
  impressions: number;
  reach: number;
  clicks: number;
  socialClicks: number;
  ctr: number;
  engagement: number;
  likes: number;
  comments: number;
  hashtagPerformance: Array<{ tag: string; impressions: number; trendScore: number }>;
  audienceActivityScore: number;
}

export interface EvaluationResult {
  round: number;
  metrics: Metrics;
  timeSeries: {
    byHour: Array<{ hour: number; engagement: number }>;
    byDay: Array<{ day: string; engagement: number }>;
  };
  qualityCoefficient: number;
  breakdown: Array<{ factor: string; effect: string; note: string }>;
  feedback: string;
  visibleEngagement: Array<{
    user: string;
    type: "comment" | "like" | "emoji";
    text?: string;
    likes?: number;
  }>;
}

export interface EvaluationRequest {
  challenge: Challenge;
  post: Post;
  actions: ActionSelection;
  previousResult?: EvaluationResult | null;
  round: number;
}

export interface GameState {
  challengeId: string;
  currentRound: number;
  totalRounds: number;
  tokenBalance: number;
  history: Array<{
    round: number;
    post: Post;
    actions: ActionSelection;
    result: EvaluationResult;
  }>;
  status: "in_progress" | "finished";
}

export interface LeaderboardEntry {
  groupName: string;
  finalScore: number;
  bestMetric: string;
  isYou: boolean;
}

// LLM 层只负责这几个软性字段，数值量级不经手 LLM
export interface LlmJudgement {
  qualityCoefficient: number; // 0.7..1.3
  contentNotes: string[];
  feedback: string;
  visibleEngagement: EvaluationResult["visibleEngagement"];
}
