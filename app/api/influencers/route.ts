import { NextResponse } from "next/server";
import { INFLUENCERS } from "@/lib/data/challenge";

export async function GET() {
  return NextResponse.json({ influencers: INFLUENCERS });
}
