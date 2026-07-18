# Teacher Challenge Management (Edit + Archive/Delete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teachers edit a published challenge (with structural fields locked once students have joined) and either archive (reversible, hides from the default list) or permanently delete (cascades to all student data) a challenge — closing the gap where currently a published challenge can only be paused/resumed/ended, never edited or removed.

**Architecture:** Extend the existing `/api/challenges` and `/api/challenges/[id]` routes with `PUT` (edit), a widened `PATCH` (now also toggles `archivedAt`), and `DELETE` (permanent, relies on the cascade deletes already present in the schema from the student-account-foundation branch). Add one new page (`/teacher/[id]/edit`, cloned from the existing `/teacher/new` form) and extend two existing pages (`/teacher` dashboard, `/teacher/monitor/[challengeId]`) with the new actions.

**Tech Stack:** Next.js 16 (App Router) + Prisma 7 (SQLite) + Zod. No new dependencies, no schema migration (`Challenge.archivedAt` and the `Challenge→Group→Round` cascade deletes already exist).

## Global Constraints

- This repo's regression-test convention is standalone scripts under `scripts/` run with `npx tsx scripts/xxx.ts` against a live `npm run dev` server — not vitest. Follow it for this plan's new script too.
- Keep the dev server running for every task from Task 1 onward (all tasks touch API routes or pages that need it to verify).
- All API routes must keep returning the same JSON error shape used everywhere in this codebase: `{ error: string }` with an appropriate HTTP status.
- Follow existing code style exactly: Zod for request validation, `NextResponse.json(...)`, Tailwind utility classes matching the design tokens already used in `app/teacher/new/page.tsx` (e.g. `font-title-md`, `text-on-surface-variant`, `bg-primary`, the card/section layout with `bg-white rounded-2xl border border-[#E2E8F0] ambient-shadow`).
- **Field lock rule (binding on every task that touches edit):** when a challenge has one or more `Group` rows (i.e., at least one student has ever joined), only these fields may change on edit: `brandName`, `brandBackground`, `goal`, `targetAudience` (both `coreDemographics` and `coreInterests`), `seasonalContext`, `followerBase`. These must stay locked to their existing values: `totalRounds`, `startingTokens`, `difficulty`, `availableActions`, `leaderboardEnabled`. This must be enforced server-side (the API must silently keep the existing value for locked fields regardless of what the client sends), not just hidden in the UI.
- Do not touch `.claude/worktrees/foundation-user-auth-postgres` — unrelated, out of scope.

---

### Task 1: Extend `/api/challenges/[id]` — edit (PUT), archive toggle (widened PATCH), permanent delete (DELETE)

**Files:**
- Modify: `app/api/challenges/[id]/route.ts`

**Interfaces:**
- Produces: `PUT /api/challenges/[id]` — request body matches the same shape as `POST /api/challenges` (full challenge fields); response `{ challenge: {...same shape as GET's challenge...} }`. Server-side field lock enforced when the challenge has groups.
- Produces: `PATCH /api/challenges/[id]` — now accepts `{ status?: "active"|"paused"|"ended", archived?: boolean }` (at least one must be present); response `{ challenge: { id, status, archivedAt } }`.
- Produces: `DELETE /api/challenges/[id]` — `{ ok: true }` on success; cascades to all `Group`/`Round` rows via the schema's existing `onDelete: Cascade`.
- Modifies: `GET /api/challenges/[id]`'s response — the `challenge` object gains `archivedAt` and `groupCount` (so the edit page can decide which fields to lock without a second request).

- [ ] **Step 1: Add `groupCount` and `archivedAt` to the existing GET handler's response**

Open `app/api/challenges/[id]/route.ts`. Find:

```ts
  return NextResponse.json({
    challenge: {
      id: challenge.id,
      status: challenge.status,
      brandName: challenge.brandName,
      brandBackground: challenge.brandBackground,
      goal: challenge.goal,
      targetAudience: challenge.targetAudience,
      seasonalContext: challenge.seasonalContext,
      followerBase: challenge.followerBase,
      totalRounds: challenge.totalRounds,
      startingTokens: challenge.startingTokens,
      difficulty: challenge.difficulty,
      availableActions: challenge.availableActions,
      leaderboardEnabled: challenge.leaderboardEnabled,
      joinCode: challenge.joinCode,
      createdAt: challenge.createdAt,
    },
    groups,
  });
```

Replace with:

```ts
  return NextResponse.json({
    challenge: {
      id: challenge.id,
      status: challenge.status,
      brandName: challenge.brandName,
      brandBackground: challenge.brandBackground,
      goal: challenge.goal,
      targetAudience: challenge.targetAudience,
      seasonalContext: challenge.seasonalContext,
      followerBase: challenge.followerBase,
      totalRounds: challenge.totalRounds,
      startingTokens: challenge.startingTokens,
      difficulty: challenge.difficulty,
      availableActions: challenge.availableActions,
      leaderboardEnabled: challenge.leaderboardEnabled,
      joinCode: challenge.joinCode,
      archivedAt: challenge.archivedAt,
      groupCount: challenge.groups.length,
      createdAt: challenge.createdAt,
    },
    groups,
  });
```

- [ ] **Step 2: Widen the PATCH schema and handler to support the archive toggle**

Find:

```ts
const PatchSchema = z.object({
  status: z.enum(["active", "paused", "ended"]),
});

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/challenges/[id]">,
) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed" }, { status: 422 });
  }

  const existing = await prisma.challenge.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  if (existing.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Not authorized to modify this challenge" }, { status: 403 });
  }

  const challenge = await prisma.challenge.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ challenge: { id: challenge.id, status: challenge.status } });
}
```

Replace with:

```ts
const PatchSchema = z
  .object({
    status: z.enum(["active", "paused", "ended"]).optional(),
    archived: z.boolean().optional(),
  })
  .refine((d) => d.status !== undefined || d.archived !== undefined, {
    message: "must provide status or archived",
  });

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/challenges/[id]">,
) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation failed" }, { status: 422 });
  }

  const existing = await prisma.challenge.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  if (existing.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Not authorized to modify this challenge" }, { status: 403 });
  }

  const data: { status?: string; archivedAt?: Date | null } = {};
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.archived !== undefined) data.archivedAt = parsed.data.archived ? new Date() : null;

  const challenge = await prisma.challenge.update({ where: { id }, data });

  return NextResponse.json({
    challenge: { id: challenge.id, status: challenge.status, archivedAt: challenge.archivedAt },
  });
}
```

- [ ] **Step 3: Add the PUT (edit) handler**

Add this new schema and handler to the end of the file (after the PATCH handler):

```ts
const EditSchema = z.object({
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

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/challenges/[id]">,
) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = EditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const existing = await prisma.challenge.findUnique({
    where: { id },
    include: { _count: { select: { groups: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  if (existing.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Not authorized to modify this challenge" }, { status: 403 });
  }

  // 有学生加入过（groups 非空）时，回合数/初始代币/难度/可用动作/排行榜开关锁死，
  // 不管客户端传了什么都保留原值——服务端强制，不信任前端的禁用状态。
  const hasStudents = existing._count.groups > 0;
  const data = hasStudents
    ? {
        brandName: parsed.data.brandName,
        brandBackground: parsed.data.brandBackground,
        goal: parsed.data.goal,
        targetAudience: parsed.data.targetAudience,
        seasonalContext: parsed.data.seasonalContext,
        followerBase: parsed.data.followerBase,
      }
    : parsed.data;

  const challenge = await prisma.challenge.update({ where: { id }, data });

  return NextResponse.json({
    challenge: {
      id: challenge.id,
      status: challenge.status,
      brandName: challenge.brandName,
      brandBackground: challenge.brandBackground,
      goal: challenge.goal,
      targetAudience: challenge.targetAudience,
      seasonalContext: challenge.seasonalContext,
      followerBase: challenge.followerBase,
      totalRounds: challenge.totalRounds,
      startingTokens: challenge.startingTokens,
      difficulty: challenge.difficulty,
      availableActions: challenge.availableActions,
      leaderboardEnabled: challenge.leaderboardEnabled,
      joinCode: challenge.joinCode,
      archivedAt: challenge.archivedAt,
    },
  });
}
```

- [ ] **Step 4: Add the DELETE handler**

Add this to the end of the file:

```ts
export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/challenges/[id]">,
) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.challenge.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }
  if (existing.teacherId !== teacher.id) {
    return NextResponse.json({ error: "Not authorized to delete this challenge" }, { status: 403 });
  }

  // Challenge -> Group -> Round 的 onDelete: Cascade 已经在 schema 里，
  // 这一次 delete 会把该挑战下所有小组和回合记录一起删掉。
  await prisma.challenge.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Start the dev server (keep it running for the rest of this plan)**

Run: `npm run dev`
Expected: `Ready in ...ms` on `http://localhost:3000`.

- [ ] **Step 6: Smoke-test with curl**

Log in as the seeded teacher and get a cookie:
```bash
TEACHER_COOKIE=$(curl -s -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role":"teacher","email":"teacher@example.com","password":"password123"}' \
  | grep -i '^set-cookie' | sed 's/set-cookie: //I' | cut -d';' -f1)
echo "$TEACHER_COOKIE"
```

Create a throwaway challenge to test against:
```bash
curl -s -X POST http://localhost:3000/api/challenges \
  -H "Content-Type: application/json" -H "Cookie: $TEACHER_COOKIE" \
  -d '{"brandName":"Edit Test Brand","brandBackground":"x","goal":"x","targetAudience":{"coreDemographics":["A"],"coreInterests":["B"]},"seasonalContext":"x","followerBase":1000,"totalRounds":3,"startingTokens":100,"difficulty":"normal","availableActions":["boost"],"leaderboardEnabled":true}'
```
Note the `id` from the response, call it `CID` below.

Edit it (no students yet, everything should apply):
```bash
curl -s -X PUT http://localhost:3000/api/challenges/CID \
  -H "Content-Type: application/json" -H "Cookie: $TEACHER_COOKIE" \
  -d '{"brandName":"Edited Brand","brandBackground":"y","goal":"y","targetAudience":{"coreDemographics":["A"],"coreInterests":["B"]},"seasonalContext":"y","followerBase":2000,"totalRounds":5,"startingTokens":200,"difficulty":"hard","availableActions":["ad"],"leaderboardEnabled":false}'
```
Expected: `200`, response shows `brandName: "Edited Brand"`, `totalRounds: 5` (changed, since no students yet).

Archive it, then confirm it's excluded from the default list and included with `?archived=true` (the `?archived=true` filter is added in Task 2 — for now just confirm the PATCH itself works):
```bash
curl -s -i -X PATCH http://localhost:3000/api/challenges/CID \
  -H "Content-Type: application/json" -H "Cookie: $TEACHER_COOKIE" \
  -d '{"archived":true}'
```
Expected: `200`, `archivedAt` is a non-null timestamp.

Unarchive it:
```bash
curl -s -X PATCH http://localhost:3000/api/challenges/CID \
  -H "Content-Type: application/json" -H "Cookie: $TEACHER_COOKIE" \
  -d '{"archived":false}'
```
Expected: `200`, `archivedAt` is `null`.

Delete it:
```bash
curl -s -i -X DELETE http://localhost:3000/api/challenges/CID -H "Cookie: $TEACHER_COOKIE"
```
Expected: `200`, `{"ok":true}`.

```bash
curl -s -i http://localhost:3000/api/challenges/CID -H "Cookie: $TEACHER_COOKIE"
```
Expected: `404` (confirms it's really gone).

- [ ] **Step 7: Commit**

```bash
git add app/api/challenges/\[id\]/route.ts
git commit -m "feat(teacher): add challenge edit (PUT), archive toggle (PATCH), permanent delete (DELETE)"
```

---

### Task 2: `GET /api/challenges` — filter archived, include `archivedAt`

**Files:**
- Modify: `app/api/challenges/route.ts`

**Interfaces:**
- Consumes: nothing new.
- Modifies: `GET /api/challenges` — now accepts `?archived=true` query param (defaults to showing only non-archived); response's `challenges[]` entries gain `archivedAt`.

- [ ] **Step 1: Edit the GET handler**

Find:

```ts
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
```

Replace with:

```ts
export async function GET(request: Request) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const url = new URL(request.url);
  const showArchived = url.searchParams.get("archived") === "true";

  const challenges = await prisma.challenge.findMany({
    where: { teacherId: teacher.id, archivedAt: showArchived ? { not: null } : null },
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
      archivedAt: c.archivedAt,
    })),
  });
}
```

- [ ] **Step 2: Smoke-test with curl**

Using `$TEACHER_COOKIE` from Task 1:
```bash
curl -s http://localhost:3000/api/challenges -H "Cookie: $TEACHER_COOKIE" | head -c 300
```
Expected: `200`, a `challenges` array where no entry has a non-null `archivedAt` (default view excludes archived).

```bash
curl -s "http://localhost:3000/api/challenges?archived=true" -H "Cookie: $TEACHER_COOKIE" | head -c 300
```
Expected: `200`, a `challenges` array (likely empty at this point, since Task 1's test challenge was permanently deleted, not left archived).

- [ ] **Step 3: Commit**

```bash
git add app/api/challenges/route.ts
git commit -m "feat(teacher): filter archived challenges out of the default list"
```

---

### Task 3: Edit page — `/teacher/[id]/edit`

**Files:**
- Create: `app/teacher/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `GET /api/challenges/[id]` (Task 1, now returns `archivedAt`/`groupCount`), `PUT /api/challenges/[id]` (Task 1).
- Produces: `/teacher/[id]/edit` — same form layout as `/teacher/new`, prefilled with the challenge's current values. When `groupCount > 0`, the structural fields (Difficulty, Starting Budget, Total Rounds, Available Actions, Enable Leaderboard) are rendered disabled with an explanatory note instead of editable controls.

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MaterialIcon } from "@/components/MaterialIcon";
import type { ActionKey, Difficulty } from "@/lib/types";

const ACTION_TOGGLES: Array<{ key: ActionKey; icon: string; label: string }> = [
  { key: "boost", icon: "campaign", label: "Post Boosting" },
  { key: "ad", icon: "ads_click", label: "Paid Ads" },
  { key: "audience", icon: "groups", label: "Audience Targeting" },
  { key: "influencer", icon: "star", label: "Influencer Partnerships" },
];

export default function EditChallengePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const [brandName, setBrandName] = useState("");
  const [backgroundDesc, setBackgroundDesc] = useState("");
  const [goal, setGoal] = useState("");
  const [demographics, setDemographics] = useState("");
  const [interests, setInterests] = useState("");
  const [seasonalContext, setSeasonalContext] = useState("");
  const [followerBase, setFollowerBase] = useState(1000);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [startingTokens, setStartingTokens] = useState(100);
  const [totalRounds, setTotalRounds] = useState(3);
  const [actions, setActions] = useState<ActionKey[]>(["boost", "ad", "audience", "influencer"]);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/challenges/${params.id}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setLoadError(data.error ?? "Failed to load this challenge");
          return;
        }
        const data = await res.json();
        const c = data.challenge;
        setBrandName(c.brandName);
        setBackgroundDesc(c.brandBackground);
        setGoal(c.goal);
        setDemographics(c.targetAudience.coreDemographics.join(", "));
        setInterests(c.targetAudience.coreInterests.join(", "));
        setSeasonalContext(c.seasonalContext);
        setFollowerBase(c.followerBase);
        setDifficulty(c.difficulty);
        setStartingTokens(c.startingTokens);
        setTotalRounds(c.totalRounds);
        setActions(c.availableActions);
        setLeaderboardEnabled(c.leaderboardEnabled);
        setLocked(c.groupCount > 0);
      })
      .catch(() => setLoadError("Network error, please try again"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleAction(key: ActionKey) {
    if (locked) return;
    setActions((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));
  }

  const canSubmit =
    brandName.trim() && backgroundDesc.trim() && goal.trim() && seasonalContext.trim();

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/challenges/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName,
          brandBackground: backgroundDesc,
          goal,
          targetAudience: {
            coreDemographics: demographics
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            coreInterests: interests
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          },
          seasonalContext,
          followerBase,
          totalRounds,
          startingTokens,
          difficulty,
          availableActions: actions,
          leaderboardEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      router.push(`/teacher/monitor/${params.id}`);
    } catch {
      setError("Network error, please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="font-label-mono text-label-mono text-on-surface-variant">Loading...</p>;
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 text-center py-16">
        <MaterialIcon name="lock" className="text-4xl text-on-surface-variant" />
        <p className="text-on-surface-variant">{loadError}</p>
        <button
          className="bg-primary text-on-primary px-6 py-3 rounded-xl font-title-md text-title-md"
          onClick={() => router.replace("/teacher")}
        >
          Back to My Campaigns
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-stack-lg pb-24 md:pb-0">
      <div className="flex justify-between items-end">
        <div>
          <Link
            href="/teacher"
            className="hover:text-primary transition-colors flex items-center gap-1 text-on-surface-variant mb-2"
          >
            <MaterialIcon name="arrow_back" className="text-[20px]" /> Back to Campaigns
          </Link>
          <h1 className="font-headline-lg text-headline-lg text-on-background">Edit Challenge</h1>
          <p className="font-body-main text-body-main text-on-surface-variant mt-2 max-w-2xl">
            {locked
              ? "Students have already joined — simulation parameters are locked. You can still update the brand narrative."
              : "Update the parameters for this marketing simulation scenario."}
          </p>
        </div>
        <div className="hidden md:flex gap-4">
          <button
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            className="px-6 py-2.5 rounded-xl bg-primary text-on-primary hover:scale-95 transition-transform duration-200 shadow-md font-body-main font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <MaterialIcon name="save" />
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error && <p className="text-error font-caption text-caption">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-stack-lg">
        <div className="md:col-span-8 space-y-stack-lg">
          <section className="bg-white rounded-2xl border border-[#E2E8F0] ambient-shadow p-stack-md md:p-stack-lg">
            <div className="mb-6 pb-4 border-b border-[#E2E8F0] flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-leaf-light flex items-center justify-center text-primary">
                <MaterialIcon name="storefront" />
              </div>
              <h2 className="font-title-md text-title-md text-on-background">Brand & Narrative</h2>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Brand Name <span className="text-error-rose">*</span>
                </label>
                <input
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors"
                  placeholder="e.g., EcoBrew Coffee"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Background Description <span className="text-error-rose">*</span>
                </label>
                <textarea
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors resize-none"
                  placeholder="Describe the market situation, brand history, and current challenges..."
                  rows={4}
                  maxLength={500}
                  value={backgroundDesc}
                  onChange={(e) => setBackgroundDesc(e.target.value)}
                />
                <p className="text-caption font-caption text-on-surface-variant mt-2 text-right">
                  {backgroundDesc.length} / 500 characters
                </p>
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Campaign Goal <span className="text-error-rose">*</span>
                </label>
                <input
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors"
                  placeholder="e.g., Maximize brand awareness and initial sales"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Seasonal Context <span className="text-error-rose">*</span>
                </label>
                <input
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors"
                  placeholder="e.g., Approaching Christmas, winter sales season"
                  value={seasonalContext}
                  onChange={(e) => setSeasonalContext(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Starting Follower Base
                </label>
                <input
                  type="number"
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors font-label-mono"
                  value={followerBase}
                  onChange={(e) => setFollowerBase(Number(e.target.value))}
                />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-[#E2E8F0] ambient-shadow p-stack-md md:p-stack-lg">
            <div className="mb-6 pb-4 border-b border-[#E2E8F0] flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary-container/30 flex items-center justify-center text-secondary">
                <MaterialIcon name="groups" />
              </div>
              <h2 className="font-title-md text-title-md text-on-background">Target Audience</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Demographics (comma separated)
                </label>
                <input
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors"
                  placeholder="Women 18-34, Families 25-44"
                  value={demographics}
                  onChange={(e) => setDemographics(e.target.value)}
                />
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Core Interests (comma separated)
                </label>
                <input
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors"
                  placeholder="Sustainable Fashion, Handmade Goods"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                />
              </div>
            </div>
          </section>
        </div>

        <div className="md:col-span-4 space-y-stack-lg">
          <section className={`bg-white rounded-2xl border border-[#E2E8F0] ambient-shadow p-stack-md ${locked ? "opacity-60" : ""}`}>
            <h2 className="font-title-md text-title-md text-on-background mb-4">
              Simulation Parameters
            </h2>
            {locked && (
              <p className="font-caption text-caption text-on-surface-variant mb-4 flex items-center gap-1">
                <MaterialIcon name="lock" className="text-[16px]" /> Locked — students have joined
              </p>
            )}
            <div className="space-y-5">
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Difficulty Level
                </label>
                <div className="flex gap-2">
                  {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={locked}
                      onClick={() => setDifficulty(d)}
                      className={`flex-1 py-2 rounded-lg border font-title-md text-[14px] capitalize disabled:cursor-not-allowed ${
                        difficulty === d
                          ? "border-primary bg-leaf-light text-primary"
                          : "border-outline-variant text-on-surface-variant hover:bg-surface-variant/30"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Starting Budget (Tokens)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-token-gold">
                    <MaterialIcon name="monetization_on" />
                  </span>
                  <input
                    type="number"
                    disabled={locked}
                    className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 pl-12 pr-4 transition-colors font-label-mono text-on-background disabled:cursor-not-allowed"
                    value={startingTokens}
                    onChange={(e) => setStartingTokens(Number(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <label className="block font-title-md text-[14px] text-on-background mb-2">
                  Total Rounds
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  disabled={locked}
                  className="w-full rounded-xl border-outline-variant focus:border-primary focus:ring-primary/20 bg-surface-bg py-3 px-4 transition-colors font-label-mono text-on-background disabled:cursor-not-allowed"
                  value={totalRounds}
                  onChange={(e) => setTotalRounds(Number(e.target.value))}
                />
              </div>
            </div>
          </section>

          <section className={`bg-white rounded-2xl border border-[#E2E8F0] ambient-shadow p-stack-md ${locked ? "opacity-60" : ""}`}>
            <h2 className="font-title-md text-title-md text-on-background mb-4">
              Available Actions
            </h2>
            <p className="font-body-main text-[12px] text-on-surface-variant mb-4">
              Select which marketing levers students can pull.
            </p>
            <div className="space-y-4">
              {ACTION_TOGGLES.map((toggle) => (
                <label
                  key={toggle.key}
                  className={`flex items-center justify-between group ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-variant flex items-center justify-center text-on-surface-variant group-hover:bg-leaf-light group-hover:text-primary transition-colors">
                      <MaterialIcon name={toggle.icon} className="text-[18px]" />
                    </div>
                    <span className="font-title-md text-[14px] text-on-background">
                      {toggle.label}
                    </span>
                  </div>
                  <div
                    onClick={() => toggleAction(toggle.key)}
                    className={`w-11 h-6 rounded-full relative transition-colors ${locked ? "cursor-not-allowed" : "cursor-pointer"} ${
                      actions.includes(toggle.key) ? "bg-primary" : "bg-outline-variant"
                    }`}
                  >
                    <div
                      className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-all ${
                        actions.includes(toggle.key) ? "translate-x-full" : ""
                      }`}
                    />
                  </div>
                </label>
              ))}
              <label className={`flex items-center justify-between group pt-4 border-t border-outline-variant/30 ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}>
                <span className="font-title-md text-[14px] text-on-background">
                  Enable Leaderboard
                </span>
                <div
                  onClick={() => !locked && setLeaderboardEnabled((v) => !v)}
                  className={`w-11 h-6 rounded-full relative transition-colors ${locked ? "cursor-not-allowed" : "cursor-pointer"} ${
                    leaderboardEnabled ? "bg-primary" : "bg-outline-variant"
                  }`}
                >
                  <div
                    className={`absolute top-[2px] left-[2px] bg-white rounded-full h-5 w-5 transition-all ${
                      leaderboardEnabled ? "translate-x-full" : ""
                    }`}
                  />
                </div>
              </label>
            </div>
          </section>
        </div>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-outline-variant shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
        <button
          disabled={!canSubmit || submitting}
          onClick={handleSubmit}
          className="w-full py-3 rounded-xl bg-primary text-on-primary font-title-md shadow-md active:scale-95 transition-transform disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Manual browser check**

With the dev server running: log in as `teacher@example.com`/`password123`, go to `/teacher`, click into any existing challenge card's monitor page to get its id, then navigate to `/teacher/<that-id>/edit`. Expected: form is prefilled with the challenge's real data. If that challenge already has students (`groupCount > 0` — check the dashboard card's "groups" count), the Simulation Parameters and Available Actions sections should appear dimmed with a "Locked — students have joined" note, and their controls should not respond to clicks. Change the Brand Name and Background, click "Save Changes" — expect a redirect to `/teacher/monitor/<id>` and the new brand name reflected in the monitor page's header.

- [ ] **Step 4: Commit**

```bash
git add app/teacher/\[id\]/edit
git commit -m "feat(teacher): add challenge edit page with structural-field lock once students have joined"
```

---

### Task 4: Dashboard — Active/Archived tabs + Edit/Archive/Delete actions per card

**Files:**
- Modify: `app/teacher/page.tsx`

**Interfaces:**
- Consumes: `GET /api/challenges?archived=true|false` (Task 2), `PATCH /api/challenges/[id]` (Task 1, archive toggle), `DELETE /api/challenges/[id]` (Task 1).
- Produces: `/teacher` — a tab switch (Active / Archived) above the challenge grid; each card gains three icon buttons (Edit → `/teacher/[id]/edit`, Archive/Unarchive → PATCH, Delete → DELETE with a native `confirm()` dialog).

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of `app/teacher/page.tsx` with:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";

interface ChallengeSummary {
  id: string;
  brandName: string;
  joinCode: string;
  status: string;
  totalRounds: number;
  startingTokens: number;
  createdAt: string;
  groupCount: number;
  archivedAt: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-primary-container text-on-primary-container",
  paused: "bg-tertiary-container text-on-tertiary-container",
  ended: "bg-surface-variant text-on-surface-variant",
};

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [challenges, setChallenges] = useState<ChallengeSummary[] | null>(null);

  const load = useCallback(async (which: "active" | "archived") => {
    setChallenges(null);
    const res = await fetch(`/api/challenges?archived=${which === "archived"}`);
    const data = await res.json();
    setChallenges(data.challenges ?? []);
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function toggleArchive(id: string, archive: boolean) {
    await fetch(`/api/challenges/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: archive }),
    });
    load(tab);
  }

  async function deleteChallenge(id: string, brandName: string) {
    if (!window.confirm(`Permanently delete "${brandName}"? This also deletes every student's data for it. This cannot be undone.`)) {
      return;
    }
    await fetch(`/api/challenges/${id}`, { method: "DELETE" });
    load(tab);
  }

  return (
    <div className="flex flex-col gap-stack-lg">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-background">My Campaigns</h1>
          <p className="font-body-main text-body-main text-on-surface-variant mt-2">
            Create and manage your marketing simulation challenges.
          </p>
        </div>
        <Link
          href="/teacher/new"
          className="hidden md:flex px-6 py-2.5 rounded-xl bg-primary text-on-primary hover:scale-95 transition-transform duration-200 shadow-md font-body-main font-medium items-center gap-2"
        >
          <MaterialIcon name="add" />
          New Challenge
        </Link>
      </div>

      <div className="flex gap-2 bg-surface-container-high rounded-xl p-1 w-fit">
        {(["active", "archived"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg font-label-mono text-label-mono capitalize transition-all ${
              tab === t ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-primary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {challenges === null && (
        <p className="font-label-mono text-label-mono text-on-surface-variant">Loading...</p>
      )}

      {challenges?.length === 0 && (
        <div className="bg-white rounded-2xl border border-outline-variant/30 p-stack-lg text-center flex flex-col items-center gap-4">
          <MaterialIcon name="campaign" className="text-4xl text-on-surface-variant" />
          <p className="text-on-surface-variant">
            {tab === "active"
              ? "No challenges yet — click the button above to create your first one."
              : "No archived challenges."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-md">
        {challenges?.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md flex flex-col gap-3 hover:shadow-lg transition-shadow"
          >
            <Link href={`/teacher/monitor/${c.id}`} className="flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <h3 className="font-title-md text-title-md text-on-surface">{c.brandName}</h3>
                <span
                  className={`font-caption text-caption px-2 py-1 rounded-full uppercase ${STATUS_STYLE[c.status]}`}
                >
                  {c.status}
                </span>
              </div>
              <div className="flex items-center gap-2 font-label-mono text-label-mono text-primary">
                <MaterialIcon name="vpn_key" className="text-sm" />
                {c.joinCode}
              </div>
              <div className="flex justify-between text-caption font-caption text-on-surface-variant mt-2">
                <span className="flex items-center gap-1">
                  <MaterialIcon name="group" className="text-sm" /> {c.groupCount} groups
                </span>
                <span className="flex items-center gap-1">
                  <MaterialIcon name="autorenew" className="text-sm" /> {c.totalRounds} rounds
                </span>
              </div>
            </Link>
            <div className="flex gap-2 pt-2 border-t border-outline-variant/20">
              <button
                onClick={() => router.push(`/teacher/${c.id}/edit`)}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-surface-container-high text-on-surface font-caption text-caption"
              >
                <MaterialIcon name="edit" className="text-sm" /> Edit
              </button>
              <button
                onClick={() => toggleArchive(c.id, tab === "active")}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-surface-container-high text-on-surface font-caption text-caption"
              >
                <MaterialIcon name={tab === "active" ? "archive" : "unarchive"} className="text-sm" />
                {tab === "active" ? "Archive" : "Unarchive"}
              </button>
              <button
                onClick={() => deleteChallenge(c.id, c.brandName)}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-error-container text-on-error-container font-caption text-caption"
              >
                <MaterialIcon name="delete" className="text-sm" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/teacher/new"
        className="md:hidden fixed bottom-6 right-6 bg-primary text-on-primary rounded-full w-14 h-14 flex items-center justify-center shadow-lg"
      >
        <MaterialIcon name="add" className="text-2xl" />
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Manual browser check**

Log in as the teacher, go to `/teacher`. Expected: "Active"/"Archived" tab switch above the grid, each card now has Edit/Archive/Delete buttons below the clickable brand-name area. Click "Archive" on a challenge — expect it to disappear from the Active tab; switch to "Archived" tab — expect it to appear there with an "Unarchive" button. Click "Unarchive" — expect it to move back. Create a fresh throwaway challenge via "New Challenge", then click "Delete" on its card, confirm the browser dialog — expect it to disappear immediately from the list.

- [ ] **Step 4: Commit**

```bash
git add app/teacher/page.tsx
git commit -m "feat(teacher): add Active/Archived tabs and Edit/Archive/Delete actions to the dashboard"
```

---

### Task 5: Monitor page — Edit and Delete buttons

**Files:**
- Modify: `app/teacher/monitor/[challengeId]/page.tsx`

**Interfaces:**
- Consumes: `DELETE /api/challenges/[id]` (Task 1).
- Produces: adds an "Edit" link and a "Delete" button (with confirm) next to the existing Pause/Resume/End Challenge controls.

- [ ] **Step 1: Add the buttons**

Find this block (the status/action controls in the header):

```tsx
          <span className={`font-caption text-caption px-3 py-1.5 rounded-full uppercase ${STATUS_STYLE[challenge.status]}`}>
            {challenge.status}
          </span>
          {challenge.status !== "ended" && (
            <>
              <button
                onClick={() => setStatus(challenge.status === "paused" ? "active" : "paused")}
                className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-body-main font-medium flex items-center gap-2"
              >
                <MaterialIcon name={challenge.status === "paused" ? "play_arrow" : "pause"} />
                {challenge.status === "paused" ? "Resume" : "Pause"}
              </button>
              <button
                onClick={() => setStatus("ended")}
                className="px-4 py-2 rounded-xl bg-error text-on-error font-body-main font-medium flex items-center gap-2"
              >
                <MaterialIcon name="stop_circle" />
                End Challenge
              </button>
            </>
          )}
```

Replace with:

```tsx
          <span className={`font-caption text-caption px-3 py-1.5 rounded-full uppercase ${STATUS_STYLE[challenge.status]}`}>
            {challenge.status}
          </span>
          <button
            onClick={() => router.push(`/teacher/${params.challengeId}/edit`)}
            className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-body-main font-medium flex items-center gap-2"
          >
            <MaterialIcon name="edit" />
            Edit
          </button>
          {challenge.status !== "ended" && (
            <>
              <button
                onClick={() => setStatus(challenge.status === "paused" ? "active" : "paused")}
                className="px-4 py-2 rounded-xl bg-surface-container-high text-on-surface font-body-main font-medium flex items-center gap-2"
              >
                <MaterialIcon name={challenge.status === "paused" ? "play_arrow" : "pause"} />
                {challenge.status === "paused" ? "Resume" : "Pause"}
              </button>
              <button
                onClick={() => setStatus("ended")}
                className="px-4 py-2 rounded-xl bg-error text-on-error font-body-main font-medium flex items-center gap-2"
              >
                <MaterialIcon name="stop_circle" />
                End Challenge
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            className="px-4 py-2 rounded-xl bg-error-container text-on-error-container font-body-main font-medium flex items-center gap-2"
          >
            <MaterialIcon name="delete" />
            Delete
          </button>
```

- [ ] **Step 2: Add the `handleDelete` function**

Find:

```ts
  async function setStatus(status: "active" | "paused" | "ended") {
    await fetch(`/api/challenges/${params.challengeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }
```

Replace with:

```ts
  async function setStatus(status: "active" | "paused" | "ended") {
    await fetch(`/api/challenges/${params.challengeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Permanently delete "${challenge?.brandName}"? This also deletes every student's data for it. This cannot be undone.`,
      )
    ) {
      return;
    }
    await fetch(`/api/challenges/${params.challengeId}`, { method: "DELETE" });
    router.replace("/teacher");
  }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Manual browser check**

Open a challenge's monitor page. Expected: "Edit" button navigates to `/teacher/<id>/edit`. Go back, click "Delete", confirm the dialog — expect a redirect to `/teacher` and the challenge is gone from the dashboard.

- [ ] **Step 5: Commit**

```bash
git add app/teacher/monitor/\[challengeId\]/page.tsx
git commit -m "feat(teacher): add Edit and Delete buttons to the monitor page"
```

---

### Task 6: End-to-end regression script

**Files:**
- Create: `scripts/test-teacher-management.ts`

**Interfaces:**
- Consumes: every endpoint built in Tasks 1–2.

- [ ] **Step 1: Create the script**

```ts
// 老师端挑战管理自测：编辑（无学生时全字段可改 / 有学生时结构字段锁死）、
// 归档/取消归档（列表可见性）、永久删除（级联清空 group/round）。
// 运行前需 `npm run dev` 已在 localhost:3000 启动，且已执行过 `npm run db:seed`。
// 用法: npx tsx scripts/test-teacher-management.ts

export {};

const BASE = "http://localhost:3000";
let failures = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`✅ ${label}`);
  } else {
    console.error(`❌ ${label}`, detail ?? "");
    failures++;
  }
}

async function loginTeacher(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "teacher", email: "teacher@example.com", password: "password123" }),
  });
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("teacher login failed — did you run `npm run db:seed`?");
  return cookie.split(";")[0];
}

async function loginStudent(email: string, displayName: string): Promise<string> {
  await fetch(`${BASE}/api/auth/student/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123", displayName }),
  });
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "student", email, password: "password123" }),
  });
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("student login failed");
  return cookie.split(";")[0];
}

function baseChallengePayload(brandName: string) {
  return {
    brandName,
    brandBackground: "Throwaway brand for the teacher-management regression script.",
    goal: "Grow awareness",
    targetAudience: { coreDemographics: ["Women 18-34"], coreInterests: ["Sustainable Fashion"] },
    seasonalContext: "Winter",
    followerBase: 1000,
    totalRounds: 3,
    startingTokens: 100,
    difficulty: "normal",
    availableActions: ["boost", "ad"],
    leaderboardEnabled: true,
  };
}

async function main() {
  const teacherCookie = await loginTeacher();
  const authHeaders = { "Content-Type": "application/json", Cookie: teacherCookie };
  const suffix = Math.random().toString(36).slice(2, 8);

  // 1. 建一个挑战（无学生）
  const createRes = await fetch(`${BASE}/api/challenges`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(baseChallengePayload(`Mgmt Test ${suffix}`)),
  });
  const challenge = (await createRes.json()).challenge;
  check("Challenge created", createRes.status === 200, challenge);

  // 2. 无学生时编辑，结构字段应该真的改掉
  const editRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({ ...baseChallengePayload(`Mgmt Test Edited ${suffix}`), totalRounds: 7 }),
  });
  const edited = (await editRes.json()).challenge;
  check(
    "Edit with no students changes structural fields too",
    editRes.status === 200 && edited.totalRounds === 7 && edited.brandName === `Mgmt Test Edited ${suffix}`,
    edited,
  );

  // 3. 学生加入
  const studentCookie = await loginStudent(`mgmt-student-${suffix}@example.com`, "Mgmt Test Student");
  const joinRes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: studentCookie },
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const join = await joinRes.json();
  check("Student joins the challenge", joinRes.status === 200, join);

  // 4. 有学生后编辑，结构字段应该被服务端忽略、保留原值；文本字段仍可改
  const editLockedRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({ ...baseChallengePayload(`Mgmt Test Locked ${suffix}`), totalRounds: 9, startingTokens: 9999 }),
  });
  const editedLocked = (await editLockedRes.json()).challenge;
  check(
    "Edit with students locks structural fields but still allows text fields",
    editLockedRes.status === 200 &&
      editedLocked.totalRounds === 7 && // unchanged from step 2, NOT 9
      editedLocked.startingTokens === 100 && // unchanged, NOT 9999
      editedLocked.brandName === `Mgmt Test Locked ${suffix}`, // text field did change
    editedLocked,
  );

  // 5. 归档：默认列表看不到，?archived=true 能看到
  const archiveRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ archived: true }),
  });
  check("Archive succeeds", archiveRes.status === 200);

  const activeList = await fetch(`${BASE}/api/challenges`, { headers: { Cookie: teacherCookie } }).then((r) => r.json());
  check(
    "Archived challenge is hidden from the default (active) list",
    !activeList.challenges.some((c: { id: string }) => c.id === challenge.id),
    activeList,
  );

  const archivedList = await fetch(`${BASE}/api/challenges?archived=true`, { headers: { Cookie: teacherCookie } }).then((r) =>
    r.json(),
  );
  check(
    "Archived challenge appears in the archived list",
    archivedList.challenges.some((c: { id: string }) => c.id === challenge.id),
    archivedList,
  );

  // 6. 取消归档
  const unarchiveRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ archived: false }),
  });
  const unarchived = (await unarchiveRes.json()).challenge;
  check("Unarchive succeeds and clears archivedAt", unarchiveRes.status === 200 && unarchived.archivedAt === null, unarchived);

  // 7. 另一个老师不能编辑/删除这个挑战
  const otherTeacherEmail = `mgmt-teacher-${suffix}@example.com`;
  await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: otherTeacherEmail, password: "password123" }),
  });
  const otherLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "teacher", email: otherTeacherEmail, password: "password123" }),
  });
  const otherCookie = otherLoginRes.headers.get("set-cookie")?.split(";")[0];
  if (!otherCookie) throw new Error("no other-teacher cookie, aborting");
  const foreignEditRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: otherCookie },
    body: JSON.stringify(baseChallengePayload("Hijack Attempt")),
  });
  check("A different teacher cannot edit this challenge", foreignEditRes.status === 403);
  const foreignDeleteRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "DELETE",
    headers: { Cookie: otherCookie },
  });
  check("A different teacher cannot delete this challenge", foreignDeleteRes.status === 403);

  // 8. 永久删除：级联清掉 group/round，学生端也看不到了
  const deleteRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, {
    method: "DELETE",
    headers: { Cookie: teacherCookie },
  });
  check("Owning teacher can permanently delete", deleteRes.status === 200);

  const getAfterDeleteRes = await fetch(`${BASE}/api/challenges/${challenge.id}`, { headers: { Cookie: teacherCookie } });
  check("Challenge is really gone after delete", getAfterDeleteRes.status === 404);

  const studentListAfterDelete = await fetch(`${BASE}/api/student/challenges`, { headers: { Cookie: studentCookie } }).then(
    (r) => r.json(),
  );
  check(
    "Deleted challenge's group no longer appears in the student's list (cascade worked)",
    !studentListAfterDelete.challenges.some((c: { challengeId: string }) => c.challengeId === challenge.id),
    studentListAfterDelete,
  );

  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\n✅ Teacher challenge management PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

Run: `npx tsx scripts/test-teacher-management.ts`
Expected: a series of `✅ ...` lines, ending with `✅ Teacher challenge management PASS`.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-teacher-management.ts
git commit -m "test: add end-to-end regression script for teacher challenge management"
```

---

### Task 7: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npx eslint app lib components scripts prisma` (scoped — plain `npm run lint` also sweeps unrelated nested worktree checkouts under `.claude/worktrees/`, which is a known pre-existing repo-config gap, not something this plan fixes).
Expected: no errors (the one pre-existing `app/layout.tsx` font warning is fine).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run every regression script (dev server must be running)**

Run in order:
```bash
npx tsx scripts/test-engine.ts
npx tsx scripts/test-flow.ts
npx tsx scripts/test-race.ts
npx tsx scripts/test-student-auth.ts
npx tsx scripts/test-teacher-management.ts
```
Expected: all five print a final `✅ ... PASS` line and exit 0.

- [ ] **Step 4: Manual full walkthrough in a browser**

1. Log in as the teacher, land on `/teacher`.
2. Create a new challenge, confirm it lands on the monitor page.
3. Click "Edit" → change brand name/background → Save → confirm the monitor page shows the new name.
4. Have a student join it (via `/student` in another session/incognito, or via curl) → go back to the teacher's edit page for that same challenge → confirm the Simulation Parameters section is now locked/dimmed.
5. Go to `/teacher`, click "Archive" on that card → confirm it disappears from Active, appears under Archived → "Unarchive" it back.
6. Create a second throwaway challenge with no students, click "Delete" on its card, confirm the dialog → confirm it's permanently gone.

- [ ] **Step 5: Confirm everything is committed**

Run: `git status`
Expected: `nothing to commit, working tree clean`.
