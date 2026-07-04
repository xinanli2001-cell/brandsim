// V1 built-in challenge + influencer pool. Teacher-side create form (Day 4) can override these.

import type { Challenge, Influencer } from "../types";

export const DEFAULT_CHALLENGE: Challenge = {
  id: "ch_knitwear_green",
  brandName: "GreenKnit",
  brandBackground:
    "A local knitwear brand specializing in eco-friendly wool and sustainable craftsmanship, with a core audience of young women and environmentally conscious families.",
  goal: "Build buzz for a new line of green sweaters and maximize reach and engagement across multiple rounds.",
  targetAudience: {
    coreDemographics: ["Women 18-34", "Families 25-44"],
    coreInterests: ["Sustainable Fashion", "Handmade Goods", "Winter Style"],
  },
  seasonalContext: "Approaching Christmas, winter sales season",
  followerBase: 1200,
  totalRounds: 3,
  startingTokens: 100,
  difficulty: "normal",
  availableActions: ["boost", "ad", "audience", "influencer"],
  leaderboardEnabled: true,
};

export const INFLUENCERS: Influencer[] = [
  {
    id: "inf_ecolena",
    name: "Lena EcoLife",
    followers: 45000,
    audienceMatch: 0.85,
    niche: ["Sustainability", "Fashion"],
    cost: 5,
  },
  {
    id: "inf_knitgram",
    name: "KnitDiary",
    followers: 22000,
    audienceMatch: 0.7,
    niche: ["Handmade", "Lifestyle"],
    cost: 4,
  },
  {
    id: "inf_fashionmax",
    name: "Max Style",
    followers: 120000,
    audienceMatch: 0.45,
    niche: ["Fast Fashion", "Streetwear"],
    cost: 8,
  },
];
