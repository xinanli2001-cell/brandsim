# Student Account & Unified Login Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give students real accounts (email + password), unify the login page with a role switch for teacher/student, let students join challenges from a personal page, leave a challenge without losing their scores, and log out — replacing the current localStorage-based "Kahoot-style" anonymous join flow.

**Architecture:** Add a `Student` model parallel to the existing `Teacher` model; extend the shared `Session` table to point at either a teacher or a student. Student identity moves from browser `localStorage` to the same httpOnly-cookie session mechanism teachers already use. The `/play/*` routes gain `groupId` as a URL segment (`/play/[groupId]/...`) so a reload or bookmark still resolves to the right game — replacing the old approach of reading `groupId` out of `localStorage`.

**Tech Stack:** Next.js 16 (App Router) + Prisma 7 (SQLite via `@prisma/adapter-better-sqlite3`) + Zod + bcryptjs. No new dependencies.

## Global Constraints

- This repo has **no vitest tests today** despite `vitest` being a devDependency — the project's actual regression-test convention is standalone scripts under `scripts/` run with `npx tsx scripts/xxx.ts` against a live `npm run dev` server (see `scripts/test-flow.ts`, `scripts/test-race.ts`, `scripts/test-engine.ts`, and the README's Testing section). Follow this convention: every task below verifies with either `npx tsc --noEmit`, a `curl` smoke check against the running dev server, or one of the `scripts/test-*.ts` regression scripts — not a new vitest suite.
- Keep the dev server running (`npm run dev`, default `http://localhost:3000`) for every task from Task 4 onward. Tasks 1–3 only touch the database/schema and don't need it.
- All new/changed API routes must keep returning the same JSON error shape already used everywhere in this codebase: `{ error: string }` with an appropriate HTTP status.
- Follow the existing code style exactly: Zod for request validation, `NextResponse.json(...)`, Tailwind utility classes matching the design tokens already used in `app/join/page.tsx` / `app/teacher/login/page.tsx` (e.g. `font-title-md`, `text-on-surface-variant`, `bg-primary`).
- Do not touch the unrelated worktree at `.claude/worktrees/foundation-user-auth-postgres` — it's a stale, unrelated experiment (search/eval/plaza feature) and is out of scope.

---

### Task 1: Database schema — student accounts, dual-role sessions, soft-leave, cascades

**Files:**
- Modify: `prisma/schema.prisma`
- Generates: `prisma/migrations/<timestamp>_add_student_accounts/migration.sql` (auto-created by the migrate command)

**Interfaces:**
- Produces: Prisma Client types `Student`, and updated `Session` (nullable `teacherId`/`studentId`), `Group` (`studentId: string | null`, `leftAt: Date | null`), `Challenge` (`archivedAt: Date | null`). All later tasks import these via `@prisma/client`.

- [ ] **Step 1: Edit the schema**

Open `prisma/schema.prisma` and replace its contents with:

```prisma
// Day2: SQLite 起步（零配置）。Day5 部署前把 provider 换 "postgresql"，
// DATABASE_URL 指向 Neon，跑一次 `prisma migrate deploy` 即可迁移，业务代码不用改。

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
}

model Teacher {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())

  sessions   Session[]
  challenges Challenge[]
}

model Student {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  displayName  String
  createdAt    DateTime @default(now())

  sessions Session[]
  groups   Group[]
}

model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  teacherId String?
  teacher   Teacher? @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  studentId String?
  student   Student? @relation(fields: [studentId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Challenge {
  id                 String    @id @default(cuid())
  teacherId          String
  teacher            Teacher   @relation(fields: [teacherId], references: [id])
  status             String    @default("active") // active | paused | ended
  brandName          String
  brandBackground    String
  goal               String
  targetAudience     Json
  seasonalContext    String
  followerBase       Int
  totalRounds        Int
  startingTokens     Int
  difficulty         String
  availableActions   Json
  leaderboardEnabled Boolean
  joinCode           String    @unique
  archivedAt         DateTime?
  createdAt          DateTime  @default(now())

  groups Group[]
}

model Group {
  id           String    @id @default(cuid())
  challengeId  String
  challenge    Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  studentId    String?
  student      Student?  @relation(fields: [studentId], references: [id])
  groupName    String
  tokenBalance Int
  currentRound Int       @default(1)
  status       String    @default("in_progress") // in_progress | finished
  finalScore   Int?
  leftAt       DateTime?
  createdAt    DateTime  @default(now())

  rounds Round[]

  @@unique([challengeId, groupName])
  @@unique([challengeId, studentId])
}

model Round {
  id        String   @id @default(cuid())
  groupId   String
  group     Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  round     Int
  post      Json
  actions   Json
  result    Json
  createdAt DateTime @default(now())

  @@unique([groupId, round])
}
```

Note the two new things beyond the plan's earlier sketch:
- `Group` gets **two** unique constraints: `[challengeId, groupName]` (existing, keeps display names unique per challenge) and `[challengeId, studentId]` (new — one Group per student per challenge; SQLite treats `NULL` as distinct from every other `NULL`, so this doesn't affect any pre-existing rows with `studentId = NULL`).
- `Challenge → Group` and `Group → Round` now cascade on delete, so a future "permanently delete challenge" feature can just delete the `Challenge` row.

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name add_student_accounts`
Expected: Output ends with `Your database is now in sync with your schema.` and `✔ Generated Prisma Client`. A new folder appears under `prisma/migrations/` starting with today's timestamp and ending in `_add_student_accounts`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors (existing code doesn't yet reference the new fields, so nothing should break).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add Student model, dual-role Session, soft-leave Group, archivable Challenge"
```

---

### Task 2: Seed script — demo student account

**Files:**
- Modify: `prisma/seed.ts`

**Interfaces:**
- Produces: a seeded `Student` row (`student@example.com` / `password123` / displayName `Demo Student`) that later regression scripts (Task 16, Task 17) log in as.

- [ ] **Step 1: Edit the seed script**

In `prisma/seed.ts`, add a student constant block next to the existing teacher constants, and seed logic right after the teacher-seeding block:

```ts
const SEED_TEACHER_EMAIL = "teacher@example.com";
const SEED_TEACHER_PASSWORD = "password123";
const SEED_STUDENT_EMAIL = "student@example.com";
const SEED_STUDENT_PASSWORD = "password123";
const SEED_STUDENT_DISPLAY_NAME = "Demo Student";
```

Then, inside `main()`, right after the existing `if (!teacher) { ... }` block (before the `const c = await prisma.challenge.create(...)` call), add:

```ts
  const existingStudent = await prisma.student.findUnique({ where: { email: SEED_STUDENT_EMAIL } });
  if (!existingStudent) {
    const studentPasswordHash = await bcrypt.hash(SEED_STUDENT_PASSWORD, 10);
    const student = await prisma.student.create({
      data: {
        email: SEED_STUDENT_EMAIL,
        passwordHash: studentPasswordHash,
        displayName: SEED_STUDENT_DISPLAY_NAME,
      },
    });
    console.log("Created seed student:", student.email, "(password: " + SEED_STUDENT_PASSWORD + ")");
  }
```

- [ ] **Step 2: Run it**

Run: `npm run db:seed`
Expected: Prints `Created seed student: student@example.com (password: password123)` (or, on a second run, `Already exists, skipping seed: ...` because the challenge already exists and the function returns early — that's fine, it means the seed is idempotent).

If it printed "Already exists, skipping seed" and you need the student seeded on an existing dev.db, temporarily comment out the early-return `if (existing) { ...; return; }` check, run `npm run db:seed` once, then restore the check — or just delete `dev.db` and re-run `npx prisma migrate dev` + `npm run db:seed` for a completely fresh database.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(db): seed a demo student account for local dev and regression scripts"
```

---

### Task 3: Auth session layer — role-aware sessions

**Files:**
- Modify: `lib/auth/session.ts`
- Modify: `app/api/auth/signup/route.ts:26` (the `createSession(teacher.id)` call site)

**Interfaces:**
- Consumes: Prisma `Session`/`Teacher`/`Student` models from Task 1.
- Produces: `createSession(owner: { teacherId: string } | { studentId: string }): Promise<void>`, `destroySession(): Promise<void>` (unchanged signature), `getCurrentTeacher(): Promise<Teacher | null>` (unchanged signature/behavior), `getCurrentStudent(): Promise<Student | null>`, `getCurrentUser(): Promise<CurrentUser | null>` where `CurrentUser = { role: "teacher"; teacher: Teacher } | { role: "student"; student: Student }`. All later API-route tasks import these.

- [ ] **Step 1: Rewrite the session module**

Replace the entire contents of `lib/auth/session.ts` with:

```ts
// 教师/学生共用同一套 httpOnly cookie 会话：一行 Session 的 teacherId/studentId 二选一，
// 由调用方在创建时指定，取用时按角色分别读。登出即删行；服务端返回的用户始终是权限判断依据。

import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import type { Teacher, Student } from "@prisma/client";

const COOKIE_NAME = "brandsim_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type SessionOwner = { teacherId: string } | { studentId: string };

export async function createSession(owner: SessionOwner): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.session.create({
    data: {
      token,
      expiresAt,
      teacherId: "teacherId" in owner ? owner.teacherId : undefined,
      studentId: "studentId" in owner ? owner.studentId : undefined,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentTeacher(): Promise<Teacher | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { teacher: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.teacher;
}

export async function getCurrentStudent(): Promise<Student | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { student: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.student;
}

export type CurrentUser =
  | { role: "teacher"; teacher: Teacher }
  | { role: "student"; student: Student };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { teacher: true, student: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.teacher) return { role: "teacher", teacher: session.teacher };
  if (session.student) return { role: "student", student: session.student };
  return null;
}
```

- [ ] **Step 2: Fix the one broken call site**

In `app/api/auth/signup/route.ts`, find:

```ts
  const teacher = await prisma.teacher.create({ data: { email, passwordHash } });
  await createSession(teacher.id);
```

Replace with:

```ts
  const teacher = await prisma.teacher.create({ data: { email, passwordHash } });
  await createSession({ teacherId: teacher.id });
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add lib/auth/session.ts app/api/auth/signup/route.ts
git commit -m "feat(auth): make sessions role-aware (teacher or student)"
```

---

### Task 4: Student signup API

**Files:**
- Create: `app/api/auth/student/signup/route.ts`

**Interfaces:**
- Consumes: `createSession` from Task 3, `prisma.student` from Task 1.
- Produces: `POST /api/auth/student/signup` — request `{ email, password, displayName }`, success `200 { student: { id, email, displayName } }`, `409` if email taken, `422` on validation failure. Sets the session cookie on success.

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(40),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a valid email, a password with at least 8 characters, and a display name" },
      { status: 422 },
    );
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.student.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const student = await prisma.student.create({
    data: { email, passwordHash, displayName: parsed.data.displayName },
  });
  await createSession({ studentId: student.id });

  return NextResponse.json({
    student: { id: student.id, email: student.email, displayName: student.displayName },
  });
}
```

- [ ] **Step 2: Start the dev server (keep it running for the rest of this plan)**

Run: `npm run dev`
Expected: `Ready in ...ms` on `http://localhost:3000`. Leave this running in its own terminal/background process for every remaining task.

- [ ] **Step 3: Smoke-test with curl**

Run:
```bash
curl -i -X POST http://localhost:3000/api/auth/student/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"curl-test@example.com","password":"password123","displayName":"Curl Test"}'
```
Expected: `HTTP/1.1 200 OK`, a `Set-Cookie: brandsim_session=...` header, and JSON body `{"student":{"id":"...","email":"curl-test@example.com","displayName":"Curl Test"}}`.

Run the exact same command again.
Expected: `HTTP/1.1 409 Conflict` with `{"error":"An account with this email already exists"}`.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/student/signup/route.ts
git commit -m "feat(auth): add student signup endpoint"
```

---

### Task 5: Login API — role-aware

**Files:**
- Modify: `app/api/auth/login/route.ts`

**Interfaces:**
- Consumes: `createSession` from Task 3.
- Produces: `POST /api/auth/login` now requires a `role: "teacher" | "student"` field. Success `200 { role: "teacher", teacher: {...} }` or `200 { role: "student", student: {...} }`. `401` on bad credentials (same generic message regardless of role, to avoid leaking which emails exist), `422` on validation failure.

- [ ] **Step 1: Rewrite the route**

Replace the entire contents of `app/api/auth/login/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

const BodySchema = z.object({
  role: z.enum(["teacher", "student"]),
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter your email and password" }, { status: 422 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const genericError = NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });

  if (parsed.data.role === "teacher") {
    const teacher = await prisma.teacher.findUnique({ where: { email } });
    if (!teacher) return genericError;
    const valid = await bcrypt.compare(parsed.data.password, teacher.passwordHash);
    if (!valid) return genericError;
    await createSession({ teacherId: teacher.id });
    return NextResponse.json({ role: "teacher", teacher: { id: teacher.id, email: teacher.email } });
  }

  const student = await prisma.student.findUnique({ where: { email } });
  if (!student) return genericError;
  const valid = await bcrypt.compare(parsed.data.password, student.passwordHash);
  if (!valid) return genericError;
  await createSession({ studentId: student.id });
  return NextResponse.json({
    role: "student",
    student: { id: student.id, email: student.email, displayName: student.displayName },
  });
}
```

- [ ] **Step 2: Smoke-test with curl**

Run:
```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role":"student","email":"student@example.com","password":"password123"}'
```
Expected: `200 OK`, `Set-Cookie` header present, body `{"role":"student","student":{"id":"...","email":"student@example.com","displayName":"Demo Student"}}`.

Run:
```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role":"teacher","email":"student@example.com","password":"password123"}'
```
Expected: `401 Unauthorized` — a student's credentials must not work through the teacher role (there's no Teacher row with that email).

Run:
```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role":"teacher","email":"teacher@example.com","password":"password123"}'
```
Expected: `200 OK`, body `{"role":"teacher","teacher":{"id":"...","email":"teacher@example.com"}}`.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/login/route.ts
git commit -m "feat(auth): make login role-aware (teacher or student)"
```

---

### Task 6: Me API — role-aware, and fix TeacherShell

**Files:**
- Modify: `app/api/auth/me/route.ts`
- Modify: `app/teacher/TeacherShell.tsx`

**Interfaces:**
- Consumes: `getCurrentUser` from Task 3.
- Produces: `GET /api/auth/me` returns `200 { role: "teacher", teacher: {...} }` or `200 { role: "student", student: {...} }`, or `401 { error: "Not logged in" }`.

- [ ] **Step 1: Rewrite the route**

Replace the entire contents of `app/api/auth/me/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (user.role === "teacher") {
    return NextResponse.json({
      role: "teacher",
      teacher: { id: user.teacher.id, email: user.teacher.email },
    });
  }
  return NextResponse.json({
    role: "student",
    student: { id: user.student.id, email: user.student.email, displayName: user.student.displayName },
  });
}
```

- [ ] **Step 2: Fix `TeacherShell.tsx`'s guard**

The login page is moving from `/teacher/login` to `/` in Task 13, so `TeacherShell` no longer needs its `isLoginPage` special case (that route won't exist anymore under `/teacher`), and it must reject a logged-in *student* who happens to hit `/teacher/*` instead of showing a broken page.

Open `app/teacher/TeacherShell.tsx`. Find:

```tsx
  const isLoginPage = pathname === "/teacher/login";

  useEffect(() => {
    if (isLoginPage) return;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          setStatus("unauthed");
          return;
        }
        const data = await res.json();
        setEmail(data.teacher.email);
        setStatus("authed");
      })
      .catch(() => setStatus("unauthed"));
  }, [isLoginPage]);

  useEffect(() => {
    if (status === "unauthed") router.replace("/teacher/login");
  }, [status, router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/teacher/login");
  }

  if (isLoginPage) return <>{children}</>;
```

Replace with:

```tsx
  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          setStatus("unauthed");
          return;
        }
        const data = await res.json();
        if (data.role !== "teacher") {
          setStatus("unauthed");
          return;
        }
        setEmail(data.teacher.email);
        setStatus("authed");
      })
      .catch(() => setStatus("unauthed"));
  }, []);

  useEffect(() => {
    if (status === "unauthed") router.replace("/");
  }, [status, router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }
```

Also remove the now-unused `pathname` variable if nothing else in the file uses it — check with:

Run: `grep -n "pathname" app/teacher/TeacherShell.tsx`
Expected: it's still used to compute `active` for the nav links (`pathname === item.href`), so **keep** the `const pathname = usePathname();` line — only the `isLoginPage` constant and its two usages above are removed.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Manual smoke test**

With the dev server running and a teacher session cookie from Task 5's curl test, visit `http://localhost:3000/teacher` in a browser after logging in via the not-yet-built unified page — **skip this manual browser check for now**, it will be covered end-to-end once Task 13 exists. For this task, just confirm via curl:

```bash
curl -s http://localhost:3000/api/auth/me -H "Cookie: brandsim_session=<paste the teacher cookie value from Task 5's Set-Cookie header>"
```
Expected: `{"role":"teacher","teacher":{"id":"...","email":"teacher@example.com"}}`.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/me/route.ts app/teacher/TeacherShell.tsx
git commit -m "feat(auth): make /api/auth/me role-aware; guard TeacherShell against non-teacher sessions"
```

---

### Task 7: Group display-name dedupe helper

**Files:**
- Create: `lib/data/group.ts`

**Interfaces:**
- Produces: `uniqueGroupName(challengeId: string, base: string): Promise<string>` — returns `base` if free within that challenge, else `base-2`, `base-3`, ... Used by Task 8.

- [ ] **Step 1: Create the helper**

```ts
// 加入挑战时，学生昵称若与本挑战内已有队伍重名，自动加数字后缀去重。

import { prisma } from "@/lib/db";

export async function uniqueGroupName(challengeId: string, base: string): Promise<string> {
  let candidate = base;
  let suffix = 2;
  while (
    await prisma.group.findUnique({
      where: { challengeId_groupName: { challengeId, groupName: candidate } },
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix++;
  }
  return candidate;
}
```

- [ ] **Step 2: Smoke-test with a throwaway script**

Create a temporary file `scripts/tmp-check-unique-name.ts`:

```ts
import { prisma } from "../lib/db";
import { uniqueGroupName } from "../lib/data/group";

async function main() {
  const teacher = await prisma.teacher.upsert({
    where: { email: "tmp-check@example.com" },
    update: {},
    create: { email: "tmp-check@example.com", passwordHash: "x" },
  });
  const challenge = await prisma.challenge.create({
    data: {
      teacherId: teacher.id,
      brandName: "tmp",
      brandBackground: "tmp",
      goal: "tmp",
      targetAudience: {},
      seasonalContext: "tmp",
      followerBase: 1,
      totalRounds: 1,
      startingTokens: 1,
      difficulty: "easy",
      availableActions: [],
      leaderboardEnabled: false,
      joinCode: "TMPCHK",
    },
  });

  const first = await uniqueGroupName(challenge.id, "Alice");
  console.log("first:", first); // expect "Alice"
  await prisma.group.create({
    data: { challengeId: challenge.id, groupName: first, tokenBalance: 0, currentRound: 1 },
  });

  const second = await uniqueGroupName(challenge.id, "Alice");
  console.log("second:", second); // expect "Alice-2"

  await prisma.challenge.delete({ where: { id: challenge.id } });
  console.log(first === "Alice" && second === "Alice-2" ? "✅ PASS" : "❌ FAIL");
}

main().finally(() => prisma.$disconnect());
```

Run: `npx tsx scripts/tmp-check-unique-name.ts`
Expected: prints `first: Alice`, `second: Alice-2`, `✅ PASS`.

Then delete the throwaway script — it was only for this one-time check:

Run: `rm scripts/tmp-check-unique-name.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/data/group.ts
git commit -m "feat(join): add unique-group-name helper for de-duplicating student display names"
```

---

### Task 8: Join API — student-authenticated, rejoin-after-leave

**Files:**
- Modify: `app/api/join/route.ts`

**Interfaces:**
- Consumes: `getCurrentStudent` from Task 3, `uniqueGroupName` from Task 7.
- Produces: `POST /api/join` now requires a student session and only takes `{ joinCode }` in the body (no more `groupName` — it's derived server-side from the student's `displayName`). `401` if not logged in as a student. Rejoining a challenge you previously left clears `leftAt` and reuses the same `Group` row (history intact) instead of creating a new one.

- [ ] **Step 1: Rewrite the route**

Replace the entire contents of `app/api/join/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizeJoinCode } from "@/lib/join-code";
import { uniqueGroupName } from "@/lib/data/group";
import { getCurrentStudent } from "@/lib/auth/session";
import { toChallenge, toGameState } from "@/lib/game-state";

const BodySchema = z.object({
  joinCode: z.string().min(1),
});

export async function POST(request: Request) {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const joinCode = normalizeJoinCode(parsed.data.joinCode);

  const challengeRow = await prisma.challenge.findUnique({ where: { joinCode } });
  if (!challengeRow) {
    return NextResponse.json({ error: "Join code not found" }, { status: 404 });
  }
  if (challengeRow.status === "ended") {
    return NextResponse.json({ error: "This challenge has ended" }, { status: 409 });
  }

  let group = await prisma.group.findUnique({
    where: { challengeId_studentId: { challengeId: challengeRow.id, studentId: student.id } },
    include: { rounds: true },
  });

  if (group) {
    if (group.leftAt) {
      group = await prisma.group.update({
        where: { id: group.id },
        data: { leftAt: null },
        include: { rounds: true },
      });
    }
  } else {
    const groupName = await uniqueGroupName(challengeRow.id, student.displayName);
    group = await prisma.group.create({
      data: {
        challengeId: challengeRow.id,
        studentId: student.id,
        groupName,
        tokenBalance: challengeRow.startingTokens,
        currentRound: 1,
        status: "in_progress",
      },
      include: { rounds: true },
    });
  }

  return NextResponse.json({
    groupId: group.id,
    challenge: toChallenge(challengeRow),
    gameState: toGameState(group, group.rounds, challengeRow.totalRounds),
  });
}
```

- [ ] **Step 2: Smoke-test with curl**

First, get a fresh student cookie and the seeded challenge's join code:
```bash
STUDENT_COOKIE=$(curl -s -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"role":"student","email":"student@example.com","password":"password123"}' \
  | grep -i '^set-cookie' | sed 's/set-cookie: //I' | cut -d';' -f1)
echo "$STUDENT_COOKIE"
```
Expected: prints something like `brandsim_session=abcdef...`.

```bash
curl -i -X POST http://localhost:3000/api/join \
  -H "Content-Type: application/json" -H "Cookie: $STUDENT_COOKIE" \
  -d '{"joinCode":"GREEN1"}'
```
Expected: `200 OK`, body includes `"groupId"` and `"gameState"`.

Run the exact same command again.
Expected: `200 OK`, **the same `groupId`** as before (idempotent re-join, no duplicate group).

Run without the cookie:
```bash
curl -i -X POST http://localhost:3000/api/join \
  -H "Content-Type: application/json" \
  -d '{"joinCode":"GREEN1"}'
```
Expected: `401 Unauthorized`.

- [ ] **Step 3: Commit**

```bash
git add app/api/join/route.ts
git commit -m "feat(join): require a student session, derive group name from display name, support rejoin"
```

---

### Task 9: Leave-challenge API

**Files:**
- Create: `app/api/groups/[groupId]/leave/route.ts`

**Interfaces:**
- Consumes: `getCurrentStudent` from Task 3.
- Produces: `POST /api/groups/[groupId]/leave` — `200 { ok: true }` on success, `401` if not logged in, `403` if the group belongs to a different student, `404` if the group doesn't exist. Sets `leftAt` on the `Group`; never deletes rows.

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentStudent } from "@/lib/auth/session";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/groups/[groupId]/leave">,
) {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { groupId } = await ctx.params;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  if (group.studentId !== student.id) {
    return NextResponse.json({ error: "Not authorized to leave this group" }, { status: 403 });
  }

  await prisma.group.update({ where: { id: groupId }, data: { leftAt: new Date() } });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Smoke-test with curl**

Using the `$STUDENT_COOKIE` and the `groupId` from Task 8's join response:
```bash
curl -i -X POST http://localhost:3000/api/groups/<groupId>/leave -H "Cookie: $STUDENT_COOKIE"
```
Expected: `200 OK`, `{"ok":true}`.

```bash
curl -i -X POST http://localhost:3000/api/groups/does-not-exist/leave -H "Cookie: $STUDENT_COOKIE"
```
Expected: `404 Not Found`.

- [ ] **Step 3: Commit**

```bash
git add app/api/groups
git commit -m "feat(join): add leave-challenge endpoint (soft leave, data retained)"
```

---

### Task 10: Student's challenge list API

**Files:**
- Create: `app/api/student/challenges/route.ts`

**Interfaces:**
- Consumes: `getCurrentStudent` from Task 3.
- Produces: `GET /api/student/challenges` — `200 { challenges: Array<{ groupId, challengeId, brandName, challengeStatus, groupStatus, currentRound, totalRounds, finalScore }> }`, only groups where `leftAt IS NULL`, `401` if not logged in. Consumed by the student personal page (Task 14).

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentStudent } from "@/lib/auth/session";

export async function GET() {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const groups = await prisma.group.findMany({
    where: { studentId: student.id, leftAt: null },
    include: { challenge: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    challenges: groups.map((g) => ({
      groupId: g.id,
      challengeId: g.challengeId,
      brandName: g.challenge.brandName,
      challengeStatus: g.challenge.status,
      groupStatus: g.status,
      currentRound: g.currentRound,
      totalRounds: g.challenge.totalRounds,
      finalScore: g.finalScore,
    })),
  });
}
```

- [ ] **Step 2: Smoke-test with curl**

```bash
curl -s http://localhost:3000/api/student/challenges -H "Cookie: $STUDENT_COOKIE"
```
Expected: `{"challenges":[...]}` — after Task 9's leave, the group you left should **not** appear here. Re-join it (repeat Task 8's join curl) and run this again — it should reappear.

```bash
curl -i http://localhost:3000/api/student/challenges
```
Expected: `401 Unauthorized` (no cookie).

- [ ] **Step 3: Commit**

```bash
git add app/api/student/challenges
git commit -m "feat(student): add endpoint listing a student's active (non-left) challenges"
```

---

### Task 11: Game-state ownership checks

**Files:**
- Modify: `app/api/game/[groupId]/route.ts`

**Interfaces:**
- Consumes: `getCurrentStudent` from Task 3.
- Produces: `GET /api/game/[groupId]` now requires a student session and ownership of that group (`401`/`403`), and additionally returns `groupName` in the response body (needed by `GameProvider` in Task 15, which no longer has a `groupName` from `localStorage`).

- [ ] **Step 1: Rewrite the route**

Replace the entire contents of `app/api/game/[groupId]/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentStudent } from "@/lib/auth/session";
import { toChallenge, toGameState } from "@/lib/game-state";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/game/[groupId]">,
) {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { groupId } = await ctx.params;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { rounds: true },
  });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  if (group.studentId !== student.id) {
    return NextResponse.json({ error: "Not authorized to view this group" }, { status: 403 });
  }

  const challengeRow = await prisma.challenge.findUnique({
    where: { id: group.challengeId },
  });
  if (!challengeRow) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  return NextResponse.json({
    groupId: group.id,
    groupName: group.groupName,
    challenge: toChallenge(challengeRow),
    gameState: toGameState(group, group.rounds, challengeRow.totalRounds),
  });
}
```

- [ ] **Step 2: Smoke-test with curl**

```bash
curl -s http://localhost:3000/api/game/<groupId-you-own> -H "Cookie: $STUDENT_COOKIE"
```
Expected: `200 OK`, body includes `"groupName"`.

```bash
curl -i http://localhost:3000/api/game/<groupId-you-own>
```
Expected: `401 Unauthorized` (no cookie).

- [ ] **Step 3: Commit**

```bash
git add app/api/game
git commit -m "feat(game): require the owning student's session to read a group's game state"
```

---

### Task 12: Round-submission ownership checks

**Files:**
- Modify: `app/api/rounds/route.ts:78-100` (the group-fetch and status-check block)

**Interfaces:**
- Consumes: `getCurrentStudent` from Task 3.
- Produces: `POST /api/rounds` now requires a student session and ownership of the target group (`401`/`403`), on top of its existing validation.

- [ ] **Step 1: Add the import**

At the top of `app/api/rounds/route.ts`, next to the other imports, add:

```ts
import { getCurrentStudent } from "@/lib/auth/session";
```

- [ ] **Step 2: Add the auth check right after the group is fetched**

Find:

```ts
  // 快速失败预检：不进事务，避免让白跑的 LLM 调用挡住其他请求。
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { rounds: true },
  });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  if (group.status === "finished") {
```

Replace with:

```ts
  // 快速失败预检：不进事务，避免让白跑的 LLM 调用挡住其他请求。
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { rounds: true },
  });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (group.studentId !== student.id) {
    return NextResponse.json({ error: "Not authorized to submit for this group" }, { status: 403 });
  }
  if (group.status === "finished") {
```

- [ ] **Step 3: Smoke-test with curl**

```bash
curl -i -X POST http://localhost:3000/api/rounds \
  -H "Content-Type: application/json" \
  -d '{"groupId":"<groupId-you-own>","post":{"id":"x","text":"hello world hello world","hashtags":[],"hasImage":false,"scheduledDay":"Wed","scheduledHour":12},"actions":{"totalCost":0}}'
```
Expected: `401 Unauthorized` (no cookie sent).

With the cookie added (`-H "Cookie: $STUDENT_COOKIE"`), it should proceed to the existing validation/evaluation logic (200, or a 409/402 depending on round state — not 401/403).

- [ ] **Step 4: Commit**

```bash
git add app/api/rounds/route.ts
git commit -m "feat(rounds): require the owning student's session to submit a round"
```

---

### Task 13: Unified login/signup page

**Files:**
- Modify: `app/page.tsx` (currently just `redirect("/join")` — replaced entirely)
- Delete: `app/teacher/login/page.tsx`
- Delete: `app/join/page.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/login`, `POST /api/auth/signup` (teacher, existing/unchanged), `POST /api/auth/student/signup` (Task 4).
- Produces: `/` renders a role-switch (Student/Teacher) + mode-switch (Log In/Sign Up) form. On success, navigates to `/teacher` or `/student`.

- [ ] **Step 1: Delete the old pages**

```bash
git rm app/teacher/login/page.tsx app/join/page.tsx
```

- [ ] **Step 2: Replace `app/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/MaterialIcon";

type Role = "student" | "teacher";
type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("student");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint =
        mode === "login"
          ? "/api/auth/login"
          : role === "teacher"
            ? "/api/auth/signup"
            : "/api/auth/student/signup";

      const body =
        mode === "login"
          ? { role, email, password }
          : role === "teacher"
            ? { email, password }
            : { email, password, displayName };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push(role === "teacher" ? "/teacher" : "/student");
    } catch {
      setError("Network error, please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="bg-surface-bg text-on-surface min-h-screen flex items-center justify-center font-body-main relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-leaf-light rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob" />
      <div className="absolute top-[20%] right-[-10%] w-[50%] h-[50%] bg-surface-container-high rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000" />
      <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-leaf-light rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />

      <div className="relative z-10 w-full max-w-md px-gutter-mobile">
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-[#E2E8F0] p-stack-lg flex flex-col items-center">
          <div className="mb-stack-lg text-center">
            <MaterialIcon name="storefront" className="text-[48px] text-primary" />
            <h1 className="font-display-lg text-headline-lg-mobile font-extrabold text-primary mt-base">
              MarketingSim
            </h1>
            <p className="font-body-main text-body-main text-on-surface-variant mt-stack-sm">
              Modern Social-Sim Environment
            </p>
          </div>

          <div className="w-full grid grid-cols-2 gap-2 mb-stack-md bg-surface-bg rounded-xl p-1">
            {(["student", "teacher"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRole(r);
                  setError(null);
                }}
                className={`py-2 rounded-lg font-label-mono text-label-mono transition-all ${
                  role === r
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                {r === "student" ? "Student" : "Teacher"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-stack-md">
            {mode === "signup" && role === "student" && (
              <div className="w-full">
                <label className="block font-label-mono text-label-mono text-on-surface-variant mb-base">
                  Display Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                    <MaterialIcon name="person" className="text-on-surface-variant" />
                  </span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-surface-bg border border-outline-variant rounded-xl font-body-main text-body-main focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 outline-none"
                    placeholder="How teammates will see you"
                    required
                    maxLength={40}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="w-full">
              <label className="block font-label-mono text-label-mono text-on-surface-variant mb-base">
                Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <MaterialIcon name="mail" className="text-on-surface-variant" />
                </span>
                <input
                  type="email"
                  className="w-full pl-10 pr-4 py-3 bg-surface-bg border border-outline-variant rounded-xl font-body-main text-body-main focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 outline-none"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="w-full">
              <label className="block font-label-mono text-label-mono text-on-surface-variant mb-base">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <MaterialIcon name="lock" className="text-on-surface-variant" />
                </span>
                <input
                  type="password"
                  className="w-full pl-10 pr-4 py-3 bg-surface-bg border border-outline-variant rounded-xl font-body-main text-body-main focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 outline-none"
                  placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-error text-caption font-caption text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-stack-sm w-full bg-primary text-on-primary font-title-md text-title-md py-4 rounded-xl flex items-center justify-center gap-2 transform active:scale-95 transition-all duration-200 shadow-[0_4px_14px_rgba(0,110,47,0.2)] hover:bg-surface-tint disabled:opacity-60"
            >
              <span>{loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}</span>
              {!loading && <MaterialIcon name="arrow_forward" />}
            </button>
          </form>

          <div className="mt-stack-md text-center">
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError(null);
              }}
              className="font-caption text-caption text-secondary hover:underline transition-all"
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Manual browser check**

Run: (dev server already running) open `http://localhost:3000` in a browser.
Expected: see the role/mode toggles. Switch to Teacher + Log In, submit `teacher@example.com` / `password123` → redirected to `/teacher` and the dashboard loads with your email in the sidebar. Go back to `/`, switch to Student + Log In, submit `student@example.com` / `password123` → redirected to `/student` (this 404s until Task 14 — that's expected for now, confirm the redirect itself happens and no client error is thrown before that).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(auth): replace redirect-only landing page with unified role-based login/signup"
```

---

### Task 14: Student personal page

**Files:**
- Create: `app/student/page.tsx`

**Interfaces:**
- Consumes: `GET /api/auth/me` (Task 6), `GET /api/student/challenges` (Task 10), `POST /api/join` (Task 8), `POST /api/groups/[groupId]/leave` (Task 9), `POST /api/auth/logout` (existing, unchanged).
- Produces: `/student` — shows the student's name, a logout button, a join-by-code form, and a card grid of active challenges each with "Continue" (→ `/play/[groupId]/brief`, wired up fully once Task 15 lands) and "Leave".

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MaterialIcon } from "@/components/MaterialIcon";

interface StudentMe {
  id: string;
  email: string;
  displayName: string;
}

interface ChallengeCard {
  groupId: string;
  challengeId: string;
  brandName: string;
  challengeStatus: string;
  groupStatus: string;
  currentRound: number;
  totalRounds: number;
  finalScore: number | null;
}

export default function StudentPage() {
  const router = useRouter();
  const [me, setMe] = useState<StudentMe | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [challenges, setChallenges] = useState<ChallengeCard[] | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const loadChallenges = useCallback(async () => {
    const res = await fetch("/api/student/challenges");
    if (res.ok) {
      const data = await res.json();
      setChallenges(data.challenges);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          router.replace("/");
          return;
        }
        const data = await res.json();
        if (data.role !== "student") {
          router.replace("/");
          return;
        }
        setMe(data.student);
        setAuthChecked(true);
        await loadChallenges();
      })
      .catch(() => router.replace("/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    setJoining(true);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error ?? "Failed to join");
        return;
      }
      setJoinCode("");
      router.push(`/play/${data.groupId}/brief`);
    } catch {
      setJoinError("Network error, please try again");
    } finally {
      setJoining(false);
    }
  }

  async function handleLeave(groupId: string) {
    await fetch(`/api/groups/${groupId}/leave`, { method: "POST" });
    await loadChallenges();
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  if (!authChecked || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-label-mono text-label-mono text-on-surface-variant">Loading...</p>
      </div>
    );
  }

  return (
    <main className="bg-surface-bg text-on-surface min-h-screen font-body-main">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm flex justify-between items-center px-gutter-mobile py-base w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
            <MaterialIcon name="person" className="text-on-primary-container text-lg" />
          </div>
          <span className="font-title-md text-title-md text-primary">{me.displayName}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors"
        >
          <MaterialIcon name="logout" className="text-lg" />
          <span className="font-body-main text-sm">Log out</span>
        </button>
      </header>

      <div className="max-w-container-max mx-auto px-gutter-mobile py-stack-lg flex flex-col gap-stack-lg">
        <section className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md">
          <h2 className="font-title-md text-title-md mb-4 flex items-center gap-2">
            <MaterialIcon name="vpn_key" className="text-primary" />
            Join a Challenge
          </h2>
          <form onSubmit={handleJoin} className="flex gap-3">
            <input
              className="flex-1 px-4 py-3 bg-surface-bg border border-outline-variant rounded-xl font-label-mono text-label-mono tracking-[0.2em] text-center uppercase outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              maxLength={6}
              placeholder="XXXXXX"
              required
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button
              type="submit"
              disabled={joining}
              className="px-6 py-3 bg-primary text-on-primary rounded-xl font-title-md text-title-md disabled:opacity-60"
            >
              {joining ? "Joining..." : "Join"}
            </button>
          </form>
          {joinError && <p className="text-error text-caption font-caption mt-2">{joinError}</p>}
        </section>

        <section className="flex flex-col gap-stack-md">
          <h2 className="font-title-md text-title-md">My Challenges</h2>
          {challenges === null && (
            <p className="font-label-mono text-label-mono text-on-surface-variant">Loading...</p>
          )}
          {challenges?.length === 0 && (
            <div className="bg-white rounded-2xl border border-outline-variant/30 p-stack-lg text-center text-on-surface-variant">
              You haven&apos;t joined any challenges yet — enter a join code above.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
            {challenges?.map((c) => (
              <div
                key={c.groupId}
                className="bg-white rounded-2xl border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-stack-md flex flex-col gap-3"
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-title-md text-title-md">{c.brandName}</h3>
                  <span className="font-caption text-caption px-2 py-1 rounded-full uppercase bg-surface-container-high text-on-surface-variant">
                    {c.groupStatus === "finished" ? "Finished" : `Round ${c.currentRound}/${c.totalRounds}`}
                  </span>
                </div>
                <div className="flex gap-3 mt-2">
                  <Link
                    href={`/play/${c.groupId}/brief`}
                    className="flex-1 text-center py-2.5 rounded-xl bg-primary text-on-primary font-body-main font-medium"
                  >
                    Continue
                  </Link>
                  <button
                    onClick={() => handleLeave(c.groupId)}
                    className="px-4 py-2.5 rounded-xl bg-surface-container-high text-error font-body-main font-medium"
                  >
                    Leave
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Manual browser check**

Log in as the student (`student@example.com` / `password123`) via `/`. Expected: lands on `/student`, shows "Demo Student" in the header, a join form, and (if Task 8's curl tests left a joined-but-not-left group) a challenge card for the seeded "GREEN1" brand. Enter join code `GREEN1` again — expected: navigates towards `/play/<groupId>/brief` (404 for now, until Task 15). Go back to `/student`, click "Leave" on a card — expected: the card disappears from the list. Click "Log out" — expected: redirected to `/`.

- [ ] **Step 4: Commit**

```bash
git add app/student
git commit -m "feat(student): add personal page with join/continue/leave/logout"
```

---

### Task 15: Play routes gain `groupId`; drop localStorage entirely

**Files:**
- Create: `app/play/[groupId]/layout.tsx` (moved content from `app/play/layout.tsx`)
- Create: `app/play/[groupId]/brief/page.tsx` (moved + edited from `app/play/brief/page.tsx`)
- Create: `app/play/[groupId]/compose/page.tsx` (moved + edited from `app/play/compose/page.tsx`)
- Create: `app/play/[groupId]/dashboard/page.tsx` (moved + edited from `app/play/dashboard/page.tsx`)
- Create: `app/play/[groupId]/result/page.tsx` (moved, unedited, from `app/play/result/page.tsx`)
- Delete: `app/play/layout.tsx`, `app/play/brief/`, `app/play/compose/`, `app/play/dashboard/`, `app/play/result/` (old locations)
- Modify: `app/play/GameProvider.tsx` (full rewrite)
- Modify: `components/BottomNav.tsx` (full rewrite)
- Delete: `lib/client/session.ts`, `lib/client/teacher-session.ts`

**Interfaces:**
- Consumes: `GET /api/game/[groupId]` (Task 11, now returns `groupName`).
- Produces: `useGame()` still returns `{ session: { groupId, challengeId, groupName }, challenge, gameState, refresh }` — same shape as before, so `brief`/`compose`/`dashboard`/`result` pages barely change beyond fixing their hardcoded route strings.

- [ ] **Step 1: Move the directory structure with git**

```bash
mkdir -p app/play/\[groupId\]
git mv app/play/layout.tsx app/play/\[groupId\]/layout.tsx
git mv app/play/brief app/play/\[groupId\]/brief
git mv app/play/compose app/play/\[groupId\]/compose
git mv app/play/dashboard app/play/\[groupId\]/dashboard
git mv app/play/result app/play/\[groupId\]/result
```

- [ ] **Step 2: Fix the moved layout's relative imports**

`app/play/[groupId]/layout.tsx` is now one directory deeper, so its imports need an extra `../`. Its content should be exactly:

```tsx
import { GameProvider } from "../GameProvider";
import { PlayShell } from "../PlayShell";

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <GameProvider>
      <PlayShell>{children}</PlayShell>
    </GameProvider>
  );
}
```

- [ ] **Step 3: Rewrite `GameProvider.tsx`**

Replace the entire contents of `app/play/GameProvider.tsx` with:

```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Challenge, GameState } from "@/lib/types";

export interface PlaySession {
  groupId: string;
  challengeId: string;
  groupName: string;
}

interface GameContextValue {
  session: PlaySession;
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
  const params = useParams<{ groupId: string }>();
  const [session, setSession] = useState<PlaySession | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/game/${params.groupId}`);
    if (res.status === 401) {
      router.replace("/");
      return;
    }
    if (res.status === 403) {
      setError("This challenge doesn't belong to your account.");
      return;
    }
    if (!res.ok) {
      setError("Group not found. Please join again.");
      return;
    }
    const data = await res.json();
    setSession({ groupId: data.groupId, challengeId: data.challenge.id, groupName: data.groupName });
    setChallenge(data.challenge);
    setGameState(data.gameState);
  }, [params.groupId, router]);

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
          onClick={() => router.replace("/student")}
        >
          Back to My Challenges
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
```

- [ ] **Step 4: Fix internal navigation in the three interactive pages**

In `app/play/[groupId]/brief/page.tsx`, find:
```tsx
  const { challenge, gameState } = useGame();
```
Replace with:
```tsx
  const { challenge, gameState, session } = useGame();
```
Then find:
```tsx
          onClick={() => router.push("/play/compose")}
```
Replace with:
```tsx
          onClick={() => router.push(`/play/${session.groupId}/compose`)}
```

In `app/play/[groupId]/compose/page.tsx`, find:
```tsx
      router.push("/play/dashboard");
```
Replace with:
```tsx
      router.push(`/play/${session.groupId}/dashboard`);
```
(`session` is already destructured from `useGame()` in this file — no other change needed there.)

In `app/play/[groupId]/dashboard/page.tsx`, find:
```tsx
  const { gameState } = useGame();

  const latest = gameState.history[gameState.history.length - 1];

  useEffect(() => {
    if (gameState.status === "finished") {
      router.replace("/play/result");
    } else if (!latest) {
      router.replace("/play/compose");
    }
  }, [gameState.status, latest, router]);
```
Replace with:
```tsx
  const { gameState, session } = useGame();

  const latest = gameState.history[gameState.history.length - 1];

  useEffect(() => {
    if (gameState.status === "finished") {
      router.replace(`/play/${session.groupId}/result`);
    } else if (!latest) {
      router.replace(`/play/${session.groupId}/compose`);
    }
  }, [gameState.status, latest, router, session.groupId]);
```
Then find:
```tsx
          onClick={() => router.push("/play/compose")}
```
Replace with:
```tsx
          onClick={() => router.push(`/play/${session.groupId}/compose`)}
```

`app/play/[groupId]/result/page.tsx` needs no navigation changes — leave it exactly as moved.

- [ ] **Step 5: Rewrite `BottomNav.tsx`**

Replace the entire contents of `components/BottomNav.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialIcon } from "./MaterialIcon";
import { useGame } from "@/app/play/GameProvider";

export function BottomNav() {
  const pathname = usePathname();
  const { session } = useGame();

  const tabs = [
    { href: `/play/${session.groupId}/brief`, icon: "campaign", label: "Challenge" },
    { href: `/play/${session.groupId}/compose`, icon: "storefront", label: "Market" },
    {
      href: `/play/${session.groupId}/dashboard#feed`,
      icon: "forum",
      label: "Social",
      match: `/play/${session.groupId}/dashboard`,
    },
    { href: `/play/${session.groupId}/dashboard`, icon: "analytics", label: "Results" },
  ];

  return (
    <nav className="bg-surface/80 backdrop-blur-md docked full-width bottom-0 fixed z-50 border-t border-outline-variant shadow-lg flex justify-around items-center px-4 pb-6 pt-2 w-full md:hidden">
      {tabs.map((tab) => {
        const active = pathname === (tab.match ?? tab.href);
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={`flex flex-col items-center justify-center rounded-xl px-4 py-1 scale-95 active:scale-90 transition-all ${
              active
                ? "bg-primary-container text-on-primary-container"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <MaterialIcon name={tab.icon} className="text-xl mb-1" />
            <span className="font-caption text-caption">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 6: Delete the now-unused localStorage session helpers**

```bash
git rm lib/client/session.ts lib/client/teacher-session.ts
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors. If you see an error about `session` being possibly undefined in `dashboard/page.tsx`, double check Step 4 was applied to the *moved* file under `app/play/[groupId]/dashboard/page.tsx`, not a leftover at the old path.

- [ ] **Step 8: Manual browser walkthrough**

With the dev server running: log in as the student, click "Join" with code `GREEN1` (or "Continue" on an existing card) on `/student`. Expected: lands on `/play/<groupId>/brief` showing the challenge brief. Click "Start Round N" → lands on `/play/<groupId>/compose`. Fill in post text, click "Publish & Evaluate" → lands on `/play/<groupId>/dashboard` showing the round's results. Use the bottom nav tabs (on a narrow/mobile viewport) to jump between Challenge/Market/Social/Results — confirm each highlights correctly and the URL always contains the same `groupId`. Reload the browser on `/play/<groupId>/dashboard` — expected: the page still loads correctly (no more reliance on localStorage).

- [ ] **Step 9: Commit**

```bash
git add app/play components/BottomNav.tsx
git commit -m "refactor(play): move play routes under /play/[groupId], drop localStorage session"
```

---

### Task 16: Update existing regression scripts for auth

**Files:**
- Modify: `scripts/test-flow.ts`
- Modify: `scripts/test-race.ts`

**Interfaces:**
- Consumes: `POST /api/auth/login`, `POST /api/challenges` (existing teacher endpoint, unchanged), `POST /api/join` (Task 8), `POST /api/rounds` (Task 12), `GET /api/game/[groupId]` (Task 11).

Both scripts previously hit `/api/join` and `/api/rounds` with no authentication, and `/api/join` took a `groupName` field that no longer exists. They also relied on the fixed seeded `GREEN1` challenge and a randomized `groupName` to get a fresh `Group` on every run — but a student can now only have **one** `Group` per challenge (Task 1's `[challengeId, studentId]` unique constraint), so re-running against the same challenge would hit "round already submitted" / "already finished" on the second run. Fix: each script logs in as the seed teacher, creates a **fresh throwaway challenge** every run (so the seed student always gets a brand-new `Group`), then logs in as the seed student to join and play it.

- [ ] **Step 1: Rewrite `scripts/test-flow.ts`**

Replace its entire contents with:

```ts
// 端到端流程自测：登录（老师建挑战 + 学生登录）-> join -> 提交N轮 -> finished -> 真实排行榜。
// 运行前需 `npm run dev` 已在 localhost:3000 启动，且已执行过 `npm run db:seed`（提供种子老师/学生账号）。
// 用法: npx tsx scripts/test-flow.ts

export {};

const BASE = "http://localhost:3000";

async function login(role: "teacher" | "student", email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, email, password }),
  });
  if (!res.ok) {
    throw new Error(`Failed to log in as ${role} (${email}) — did you run \`npm run db:seed\`?`);
  }
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("Login response did not set a session cookie");
  return cookie.split(";")[0];
}

async function createThrowawayChallenge(
  teacherCookie: string,
): Promise<{ id: string; joinCode: string; totalRounds: number }> {
  const res = await fetch(`${BASE}/api/challenges`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({
      brandName: "Test Flow Brand " + Math.random().toString(36).slice(2, 6),
      brandBackground: "A throwaway brand created by the test-flow regression script.",
      goal: "Grow awareness",
      targetAudience: { coreDemographics: ["Women 18-34"], coreInterests: ["Sustainable Fashion"] },
      seasonalContext: "Winter",
      followerBase: 1000,
      totalRounds: 3,
      startingTokens: 100,
      difficulty: "normal",
      availableActions: ["boost", "ad", "audience", "influencer"],
      leaderboardEnabled: true,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Failed to create throwaway challenge: " + JSON.stringify(data));
  return data.challenge;
}

async function main() {
  const teacherCookie = await login("teacher", "teacher@example.com", "password123");
  const challenge = await createThrowawayChallenge(teacherCookie);
  console.log("== created challenge ==", challenge.id, challenge.joinCode);

  const studentCookie = await login("student", "student@example.com", "password123");
  const authHeaders = { "Content-Type": "application/json", Cookie: studentCookie };

  const joinRes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const join = await joinRes.json();
  console.log("== join ==", joinRes.status, { groupId: join.groupId, tokenBalance: join.gameState?.tokenBalance });
  if (!joinRes.ok) throw new Error("join failed");

  const groupId = join.groupId;
  const totalRounds = join.challenge.totalRounds;

  for (let round = 1; round <= totalRounds; round++) {
    const res = await fetch(`${BASE}/api/rounds`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        groupId,
        post: {
          id: `post_flow_${groupId}_${round}`,
          text: `🌿 Round ${round}: eco-friendly green sweaters, limited release — click to learn more`,
          hashtags: ["#SustainableFashion", "#GreenSweater"],
          hasImage: true,
          imageStyle: "cozy-lifestyle",
          scheduledDay: "Wed",
          scheduledHour: 19,
        },
        actions: {
          boost: { level: 1, cost: 3 },
          audience: { demographics: ["Women 18-34"], interests: ["Sustainable Fashion"], cost: 4 },
          totalCost: 7,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("round failed", res.status, data);
      process.exit(1);
    }
    console.log(
      `== round ${round} ==`,
      "reach:", data.result.metrics.reach,
      "engagement:", data.result.metrics.engagement,
      "tokenBalance:", data.gameState.tokenBalance,
      "status:", data.gameState.status,
    );
  }

  const lbRes = await fetch(`${BASE}/api/leaderboard/${challenge.id}?groupId=${groupId}`);
  const lb = await lbRes.json();
  console.log("== leaderboard ==", lbRes.status);
  console.table(lb.entries);

  const you = lb.entries.find((e: { isYou: boolean }) => e.isYou);
  if (!you) throw new Error("This group did not appear on the leaderboard");
  console.log("\n✅ End-to-end flow PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

Run: `npx tsx scripts/test-flow.ts`
Expected: ends with `✅ End-to-end flow PASS`. Run it a **second time** immediately after — it must still pass (proves the fresh-challenge-per-run fix works and there's no leftover state issue).

- [ ] **Step 3: Rewrite `scripts/test-race.ts`**

Replace its entire contents with:

```ts
// 并发自测：多个并发提交打到同一个 group，确认不会出现重复/缺失的轮次号、
// 代币扣减和实际成功的提交次数对得上——不管 Node 事件循环怎么交错调度请求。
// 运行前需 `npm run dev` 已在 localhost:3000 启动，且已执行过 `npm run db:seed`。
// 用法: npx tsx scripts/test-race.ts

export {};

const BASE = "http://localhost:3000";
const COST_PER_ATTEMPT = 5;
const CONCURRENCY = 6;

async function login(role: "teacher" | "student", email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, email, password }),
  });
  if (!res.ok) {
    throw new Error(`Failed to log in as ${role} (${email}) — did you run \`npm run db:seed\`?`);
  }
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("Login response did not set a session cookie");
  return cookie.split(";")[0];
}

async function createThrowawayChallenge(teacherCookie: string): Promise<{ id: string; joinCode: string }> {
  const res = await fetch(`${BASE}/api/challenges`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherCookie },
    body: JSON.stringify({
      brandName: "Race Test Brand " + Math.random().toString(36).slice(2, 6),
      brandBackground: "A throwaway brand created by the test-race regression script.",
      goal: "Grow awareness",
      targetAudience: { coreDemographics: ["Women 18-34"], coreInterests: ["Sustainable Fashion"] },
      seasonalContext: "Winter",
      followerBase: 1000,
      totalRounds: 10,
      startingTokens: 1000,
      difficulty: "normal",
      availableActions: ["boost", "ad", "audience", "influencer"],
      leaderboardEnabled: true,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Failed to create throwaway challenge: " + JSON.stringify(data));
  return data.challenge;
}

function makeBody(groupId: string) {
  return JSON.stringify({
    groupId,
    post: {
      id: `post_race_${groupId}_${Math.random().toString(36).slice(2, 6)}`,
      text: "Race condition test post with enough length to pass validation.",
      hashtags: ["#Test"],
      hasImage: false,
      scheduledDay: "Wed",
      scheduledHour: 12,
    },
    actions: { totalCost: COST_PER_ATTEMPT },
  });
}

async function main() {
  const teacherCookie = await login("teacher", "teacher@example.com", "password123");
  const challenge = await createThrowawayChallenge(teacherCookie);

  const studentCookie = await login("student", "student@example.com", "password123");
  const authHeaders = { "Content-Type": "application/json", Cookie: studentCookie };

  const joinRes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const join = await joinRes.json();
  const groupId = join.groupId;
  const startingTokens = join.gameState.tokenBalance;
  console.log("== join ==", joinRes.status, { groupId, startingTokens });

  // 打 CONCURRENCY 个完全并发的提交请求到同一个 group，逼真实"重复点击/网络重试"
  const responses = await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      fetch(`${BASE}/api/rounds`, {
        method: "POST",
        headers: authHeaders,
        body: makeBody(groupId),
      }),
    ),
  );
  const bodies = await Promise.all(responses.map((r) => r.json()));
  const statuses = responses.map((r) => r.status);
  const successCount = statuses.filter((s) => s === 200).length;

  console.log(
    "== concurrent results ==",
    statuses.map((s, i) => `${s}:${bodies[i].error ?? "ok"}`),
  );

  const gameRes = await fetch(`${BASE}/api/game/${groupId}`, { headers: { Cookie: studentCookie } });
  const game = await gameRes.json();
  const history = game.gameState.history as Array<{ round: number }>;
  const rounds = history.map((h) => h.round).sort((a: number, b: number) => a - b);
  const expectedRounds = Array.from({ length: rounds.length }, (_, i) => i + 1);

  console.log("== persisted rounds ==", rounds);
  console.log("== token balance ==", game.gameState.tokenBalance, "(started", startingTokens, ")");

  const noDuplicateOrGap = JSON.stringify(rounds) === JSON.stringify(expectedRounds);
  const successMatchesPersisted = successCount === history.length;
  const expectedBalance = startingTokens - history.length * COST_PER_ATTEMPT;
  const tokenMathCorrect = game.gameState.tokenBalance === expectedBalance;

  console.log("\nNo duplicate/missing round numbers:", noDuplicateOrGap ? "✅ PASS" : "❌ FAIL");
  console.log("Success count matches persisted rounds:", successMatchesPersisted ? "✅ PASS" : "❌ FAIL");
  console.log(
    "Token balance math correct:",
    tokenMathCorrect ? "✅ PASS" : `❌ FAIL (expected ${expectedBalance}, got ${game.gameState.tokenBalance})`,
  );

  if (!noDuplicateOrGap || !successMatchesPersisted || !tokenMathCorrect) process.exit(1);
  console.log("\n✅ Race condition guard PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Run it**

Run: `npx tsx scripts/test-race.ts`
Expected: ends with `✅ Race condition guard PASS`.

- [ ] **Step 5: Commit**

```bash
git add scripts/test-flow.ts scripts/test-race.ts
git commit -m "test: update regression scripts to authenticate and use a fresh challenge per run"
```

---

### Task 17: New regression script — full account-system coverage

**Files:**
- Create: `scripts/test-student-auth.ts`

**Interfaces:**
- Consumes: every endpoint built in Tasks 4–12.

- [ ] **Step 1: Create the script**

```ts
// 学生账号体系自测：注册/重复邮箱拒绝/角色登录隔离/加入-退出-重新加入/未登录访问被拒/重名去重。
// 运行前需 `npm run dev` 已在 localhost:3000 启动，且已执行过 `npm run db:seed`。
// 用法: npx tsx scripts/test-student-auth.ts

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

async function login(role: "teacher" | "student", email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, email, password }),
  });
  const cookie = res.headers.get("set-cookie");
  return { res, cookie: cookie ? cookie.split(";")[0] : null };
}

async function main() {
  const suffix = Math.random().toString(36).slice(2, 8);
  const email = `student-${suffix}@example.com`;
  const password = "password123";
  const displayName = "Auth Test Student";

  // 1. 学生注册
  const signupRes = await fetch(`${BASE}/api/auth/student/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });
  const signup = await signupRes.json();
  check("Student signup succeeds", signupRes.status === 200, signup);

  // 2. 重复邮箱注册被拒
  const dupRes = await fetch(`${BASE}/api/auth/student/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });
  check("Duplicate email signup rejected with 409", dupRes.status === 409, await dupRes.json());

  // 3. 用学生邮箱走老师登录角色应失败（没有同邮箱的 Teacher 行）
  const wrongRole = await login("teacher", email, password);
  check("Student credentials rejected for teacher-role login", wrongRole.res.status === 401);

  // 4. 正常学生登录
  const { res: loginRes, cookie: studentCookie } = await login("student", email, password);
  check("Student login succeeds", loginRes.status === 200 && !!studentCookie);
  if (!studentCookie) throw new Error("no student cookie, aborting");
  const authHeaders = { "Content-Type": "application/json", Cookie: studentCookie };

  // 5. 未登录访问 /api/student/challenges 被拒
  const anonRes = await fetch(`${BASE}/api/student/challenges`);
  check("Unauthenticated challenge list request rejected with 401", anonRes.status === 401);

  // 6. 老师建一个挑战供加入
  const teacherLogin = await login("teacher", "teacher@example.com", "password123");
  if (!teacherLogin.cookie) throw new Error("no teacher cookie, aborting");
  const challengeRes = await fetch(`${BASE}/api/challenges`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: teacherLogin.cookie },
    body: JSON.stringify({
      brandName: "Auth Test Brand",
      brandBackground: "Throwaway brand for the auth regression script.",
      goal: "Grow awareness",
      targetAudience: { coreDemographics: ["Women 18-34"], coreInterests: ["Sustainable Fashion"] },
      seasonalContext: "Winter",
      followerBase: 1000,
      totalRounds: 3,
      startingTokens: 100,
      difficulty: "normal",
      availableActions: ["boost", "ad", "audience", "influencer"],
      leaderboardEnabled: true,
    }),
  });
  const challenge = (await challengeRes.json()).challenge;

  // 7. 学生加入
  const joinRes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const join = await joinRes.json();
  check("Join succeeds", joinRes.status === 200, join);
  const groupId = join.groupId;

  // 8. 挑战列表里能看到刚加入的
  const listRes = await fetch(`${BASE}/api/student/challenges`, { headers: { Cookie: studentCookie } });
  const list = await listRes.json();
  check(
    "Newly joined challenge appears in the list",
    list.challenges.some((c: { groupId: string }) => c.groupId === groupId),
    list,
  );

  // 9. 另一个学生用相同显示名 join 同一挑战，重名应自动加后缀
  const email2 = `student-${suffix}-b@example.com`;
  await fetch(`${BASE}/api/auth/student/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email2, password, displayName }), // 相同 displayName，制造重名
  });
  const { cookie: student2Cookie } = await login("student", email2, password);
  if (!student2Cookie) throw new Error("no second student cookie, aborting");
  const join2Res = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: student2Cookie },
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const join2 = await join2Res.json();
  check(
    "Duplicate display name in the same challenge gets a distinct group",
    join2.gameState && join.groupId !== join2.groupId,
    join2,
  );

  // 10. 退出挑战：从列表移除，但数据仍在（重新加入拿回同一个 group）
  const leaveRes = await fetch(`${BASE}/api/groups/${groupId}/leave`, {
    method: "POST",
    headers: { Cookie: studentCookie },
  });
  check("Leave request succeeds", leaveRes.status === 200);

  const listAfterLeave = await fetch(`${BASE}/api/student/challenges`, { headers: { Cookie: studentCookie } });
  const listAfterLeaveData = await listAfterLeave.json();
  check(
    "Left challenge no longer appears in the list",
    !listAfterLeaveData.challenges.some((c: { groupId: string }) => c.groupId === groupId),
    listAfterLeaveData,
  );

  const rejoinRes = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ joinCode: challenge.joinCode }),
  });
  const rejoin = await rejoinRes.json();
  check("Rejoining after leaving reuses the same group (data retained)", rejoin.groupId === groupId, rejoin);

  // 11. 另一个学生不能读取/提交别人的 group
  const foreignGameRes = await fetch(`${BASE}/api/game/${groupId}`, { headers: { Cookie: student2Cookie } });
  check("A different student cannot view someone else's group", foreignGameRes.status === 403);

  // 12. 登出后 /api/auth/me 变为未登录
  await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { Cookie: studentCookie } });
  const meAfterLogout = await fetch(`${BASE}/api/auth/me`, { headers: { Cookie: studentCookie } });
  check("Session is invalid after logout", meAfterLogout.status === 401);

  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\n✅ Student account system PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run it**

Run: `npx tsx scripts/test-student-auth.ts`
Expected: 12 lines of `✅ ...`, ending with `✅ Student account system PASS`. If any line prints `❌`, read its detail output — it points at exactly which endpoint from Tasks 4–12 regressed.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-student-auth.ts
git commit -m "test: add end-to-end regression script for the student account system"
```

---

### Task 18: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: no errors.

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
```
Expected: all four print a final `✅ ... PASS` line and exit 0.

- [ ] **Step 4: Manual full walkthrough in a browser**

1. Visit `/` → sign up a brand-new student (role Student, mode Sign Up) → lands on `/student`.
2. Join code `GREEN1` → lands on `/play/<groupId>/brief` → play through one round → dashboard shows results.
3. Go back to `/student` (e.g. via browser back or by navigating to `http://localhost:3000/student`) → the joined challenge card is there with the correct round count.
4. Click "Leave" → card disappears.
5. Click "Log out" → redirected to `/`.
6. Log back in as the same student → `/student` → click "Join" with the same code → same challenge reappears with round progress **intact** (proves the soft-leave preserved data).
7. Log in as `teacher@example.com` / `password123` (role Teacher) → lands on `/teacher` and the dashboard loads normally (proves TeacherShell's role guard from Task 6 didn't break the existing teacher flow).

- [ ] **Step 5: Confirm everything is committed**

Run: `git status`
Expected: `nothing to commit, working tree clean` (every prior task already committed its own changes — this just confirms no stray edits were left uncommitted).
