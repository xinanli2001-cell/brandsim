# MarketingSim

A social media simulation app for marketing education. Students act as brand managers, post content, and iterate across rounds using a hybrid AI evaluation engine (deterministic rules + an LLM-scored content quality coefficient). Teachers create challenges, get a join code, and monitor class progress in real time.

## Stack

Next.js (App Router) full-stack + Prisma (SQLite locally, Postgres-ready) + OpenAI (optional, falls back to a deterministic stub) + Recharts.

## Getting started

```bash
npm install          # also runs `prisma generate` via postinstall
npm run db:migrate    # apply migrations, create the local SQLite database
npm run db:seed       # seed the built-in "GreenKnit" challenge (join code GREEN1)
npm run dev
```

Open http://localhost:3000/join (student) or http://localhost:3000/teacher (teacher — sign up, or log in with the seeded account `teacher@example.com` / `password123`).

Optional: put `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`, default `gpt-4o-mini`) in `.env.local` to use real LLM scoring instead of the deterministic stub — everything works without it.

## Key docs

- [`../docs/data-contract.md`](../docs/data-contract.md) — the data contract / evaluation engine design (source of truth for all API shapes)
- [`../docs/deployment.md`](../docs/deployment.md) — how to deploy to Vercel + Neon Postgres

## Project structure

- `lib/engine/` — evaluation engine: seeded deterministic rules (`deterministic.ts`), LLM layer with stub fallback (`llm.ts`), orchestration (`evaluate.ts`)
- `lib/data/challenge.ts` — built-in challenge + influencer pool
- `lib/auth/session.ts` — teacher session cookie helpers (signup/login/logout/current-teacher)
- `lib/moderation.ts` — keyword-based content filter for student posts
- `app/api/` — route handlers (auth, join, rounds, game state, leaderboard, challenges CRUD)
- `app/join`, `app/play/*` — student flow
- `app/teacher/login`, `app/teacher/*` — teacher flow (sign up/log in, create challenge, live class monitor)
- `scripts/test-engine.ts`, `scripts/test-flow.ts`, `scripts/test-race.ts` — reproducibility, end-to-end, and concurrency regression checks (run with `npx tsx`)

## Scripts

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint`
- `npm run db:migrate` — create/apply a migration locally (dev)
- `npm run db:deploy` — apply existing migrations without prompting (CI/production)
- `npm run db:seed` — seed the built-in challenge
