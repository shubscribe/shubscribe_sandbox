# AGENTS.md — context for AI coding agents

This file orients any agentic coding tool (Codex, Antigravity, Cursor, Claude Code, …)
working on this repo. It's the human-and-machine "start here."

## What this is

**Mission Control** — a personal job-application tracker + outreach autopilot.
Single-user, private, deployed on Vercel. Built additively over several versions
(all live on `main`):

- **v1** pipeline tracker (board/table, stages, tasks, contacts, analytics)
- **v2** automated job discovery + Gmail inbox scanning → suggestions
- **v3** outreach autopilot (Apollo lead-gen → AI drafts → paced Gmail sends)
- **v4** dashboard briefing, daily digest email, mobile PWA, interview prep, funnel analytics
- **v5** OpenRouter provider, API-key Save/Test UX, email→applications tracking

## Stack

- **Next.js 15** (App Router, RSC + Server Actions), TypeScript, route group `(app)`
- **Drizzle ORM** + **Turso/libSQL** (SQLite). Schema in `src/db/schema.ts`.
  No migration files — schema is pushed with `drizzle-kit push`.
- **Auth.js v5** (`src/auth.ts`): Google OAuth + a dev-login fallback,
  single-user allowlist via `ALLOWED_EMAILS`. `trustHost: true`.
- **Tailwind v4** with custom "liquid glass" design tokens in `src/app/globals.css`;
  `next-themes`, `sonner` toasts, `cmdk`, `@dnd-kit`, Recharts + d3-sankey.
- Icons: local SVG set in `src/components/ui/icons.tsx` (no icon library).

## Run it

```bash
npm install
# .env needs Turso creds (or leave unset to use a local SQLite file):
#   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, AUTH_SECRET
#   GOOGLE_CLIENT_ID/SECRET + ALLOWED_EMAILS for real login (else dev login)
npm run db:push     # create/update tables
npm run seed        # optional demo data (flagged, clearable in Settings)
npm run dev
```

## Build

- **Use `next build` (webpack), NOT `next build --turbopack`** — turbopack crashes
  parsing a libsql `LICENSE` file. `serverExternalPackages` in `next.config.ts`
  keeps `@libsql/*` out of the bundle. `npm run build` is already correct.

## Conventions & gotchas

- **Server-only libs** live in `src/lib/*` and start with `import "server-only"`.
  UI is in `src/components/*`; server actions in `src/actions/*` (`"use server"`).
- **LLM abstraction**: `src/lib/llm.ts` — `llm()`, `llmJson<T>()`, `hasAiKey()`.
  Provider + key + model come from the settings store (BYO key), never env.
  Providers: gemini | openrouter | anthropic | openai.
- **Settings** are a typed key-value store: `src/lib/settings.ts`
  (`getSettings`/`setSettings`, with numeric/boolean coercion lists — add new
  numeric/boolean keys to those lists or they'll read back as strings).
- **Circular deps** between `lib/discovery.ts` ↔ `lib/outreach.ts` ↔ `lib/gmail.ts`
  are broken with dynamic `await import()`. Keep that pattern.
- **Scheduling**: `/api/scan` (daily, Vercel cron in `vercel.json`) runs discovery +
  Gmail scan + inbox→applications; `/api/tick` (every 30 min, GitHub Action in
  `.github/workflows/tick.yml`) progresses outreach + digest. Both accept a
  `CRON_SECRET` bearer or a signed-in session; both are exempted in `middleware.ts`.
- **Nothing outbound sends without user approval** — cold outreach is drafted and
  queued; the user approves in `/outreach`. Preserve this human gate.
- Money/PII: API keys live in the user's own DB, used server-side only.

## Where things are

| Area | Path |
|---|---|
| DB schema | `src/db/schema.ts` |
| Seed / demo data | `src/db/seed.ts` |
| Settings store | `src/lib/settings.ts` |
| LLM | `src/lib/llm.ts` |
| Job discovery sources | `src/lib/discovery.ts` |
| Outreach engine (leads, drafts, tick) | `src/lib/outreach.ts` |
| Gmail (scan, send, inbox→apps) | `src/lib/gmail.ts` |
| Interview prep | `src/lib/prep.ts` |
| Server actions | `src/actions/*` |
| Pages | `src/app/(app)/*` |
| Shell (sidebar, bottom nav, palette) | `src/components/shell/*` |

## Git / workflow

- Feature work happens on a branch, then a PR into `main`. `main` is deployed.
- The `v1` branch is a permanent snapshot of v1 — don't touch it.
- Keep **one** agent per branch to avoid conflicts.
- Verify with `npm run build` before pushing. There is no test suite yet; the
  project is verified by building + a Playwright smoke pass against `npm start`.
