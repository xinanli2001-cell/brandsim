import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateJoinCode } from "@/lib/join-code";
import { getCurrentTeacher } from "@/lib/auth/session";

const CreateSchema = z.object({
  brandName: z.string().min(1),
  brandBackground: z.string().min(1),
  goal: z.string().min(1),
  targetAudience: z.object({
    coreDemographics: z.array(z.string()),
    coreInterests: z.array(z.string()),
  }),
  seasonalContext: z.string(),
  followerBase: z.number().int().positive(),
  totalRounds: z.number().int().min(1).max(10),
  startingTokens: z.number().int().min(0),
  difficulty: z.enum(["easy", "normal", "hard"]),
  availableActions: z.array(z.enum(["boost", "ad", "audience", "influencer"])),
  leaderboardEnabled: z.boolean(),
});

async function uniqueJoinCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateJoinCode();
    const existing = await prisma.challenge.findUnique({ where: { joinCode: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique join code");
}

export async function POST(request: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const joinCode = await uniqueJoinCode();
  const challenge = await prisma.challenge.create({
    data: { ...parsed.data, joinCode, teacherId: teacher.id },
  });

  return NextResponse.json({ challenge });
}

export async function GET() {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const challenges = await prisma.challenge.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { groups: true } } },
  });

  return NextResponse.json({
    challenges: challenges.map((c) => ({
      id: c.id,
      brandName: c.brandName,
      joinCode: c.joinCode,
      status: c.status,
      totalRounds: c.totalRounds,
      startingTokens: c.startingTokens,
      createdAt: c.createdAt,
      groupCount: c._count.groups,
    })),
  });
}
