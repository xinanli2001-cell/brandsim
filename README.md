# MarketingSim

A social media simulation app for marketing education. Students act as brand managers, post content, and iterate across rounds using a hybrid AI evaluation engine (deterministic rules + an LLM-scored content quality coefficient). Teachers create challenges, get a join code, and monitor class progress in real time.

## Stack

Next.js (App Router) full-stack + Prisma (**Postgres required**, with the `pgvector` extension for the content-plaza search feature) + OpenAI (optional, falls back to a deterministic stub) + Recharts.

## Getting started

The app requires a real Postgres database — there is no SQLite fallback anymore. `.env` is gitignored, so **every teammate needs to set this up locally after pulling**; skipping this step is the #1 cause of "everything 500s" right after a pull.

1. **Start a local Postgres with the `pgvector` extension** (a plain `postgres` image won't have `vector` available — the migrations will fail without it):
   ```bash
   docker run -d --name brandsim-pg \
     -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=brandsim \
     -p 5432:5432 pgvector/pgvector:pg16
   ```
   (If a container named `brandsim-pg` already exists, just `docker start brandsim-pg`.)

2. **Create `.env`** (copy `.env.example`) with:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/brandsim?sslmode=disable"
   ```

3. **Install, migrate, seed, run:**
   ```bash
   npm install       # also runs `prisma generate` via postinstall
   npm run db:deploy # applies all migrations to your local Postgres
   npm run db:seed   # seed teacher@example.com / password123 (join code GREEN1)
   npm run dev
   ```

Open http://localhost:3000 — pick Student or Teacher on the login page (sign up, or log in with the seeded teacher account above).

Optional: put `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, default `gpt-4o-mini`) in `.env` to use real LLM scoring instead of the deterministic stub — everything works without it.

**Troubleshooting 500s after pulling new changes:** almost always means `.env`'s `DATABASE_URL` is stale/missing, Postgres isn't running, or migrations haven't been applied — redo steps 1–3 above. `npm run db:deploy` is safe to re-run any time.

## Project structure

- `lib/engine/` — evaluation engine: seeded deterministic rules (`deterministic.ts`), LLM layer with stub fallback (`llm.ts`), orchestration (`evaluate.ts`)
- `lib/data/challenge.ts` — built-in challenge + influencer pool
- `lib/auth/session.ts` — session cookie helpers (`createSession`/`destroySession`/`getCurrentUser`) over a single unified `User` (role: `student` | `teacher`)
- `lib/auth/guards.ts` — `assertUser`/`assertTeacher`/`assertStudent` role guards used by route handlers
- `lib/moderation.ts` — keyword-based content filter for student posts
- `app/api/` — route handlers (auth, join, rounds, game state, leaderboard, challenges CRUD, plus the content-plaza posts/search/eval routes)
- `app/page.tsx`, `app/student/*`, `app/play/*` — student flow (unified login/signup lives at `/`)
- `app/teacher/*` — teacher flow (create challenge, student progress, token economy, reports, live class monitor)
- `app/plaza`, `app/search`, `app/eval` — content-plaza / search / eval-dashboard pages (separate feature line, merged in from `origin/main`)
- `scripts/test-*.ts` — regression scripts, run with `npx tsx scripts/<name>.ts` against a running `npm run dev`; see each file's header comment for what it covers

## Scripts

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` (scope to `app lib components scripts prisma` — the default scan also crawls `.claude/worktrees/**`)
- `npm test` — runs `vitest` (unit tests for `lib/auth/guards.ts` and `lib/eval/metrics.ts`)
- `npm run db:migrate` — create/apply a migration locally (dev)
- `npm run db:deploy` — apply existing migrations without prompting (CI/production)
- `npm run db:seed` — seed the built-in teacher + challenge (note: it early-returns if the `GREEN1` challenge already exists, so on a DB that already has it but is missing the seed student, create `student@example.com` manually or delete the challenge row and reseed)
