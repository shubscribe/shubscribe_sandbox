# 🚀 Mission Control — Job Tracker

A personal job-application tracker and mission-control dashboard. Dark liquid-glass UI,
drag-and-drop pipeline, action-centered dashboard, AI-assisted capture, and analytics —
built with Next.js, Turso (SQLite), and Drizzle.

## Features

- **Mission-control dashboard** — upcoming interviews, tasks due today, stale
  applications needing a nudge (default: quiet 5+ days), stat tiles, pipeline funnel,
  weekly-goal progress (default: 20/week), and an activity feed.
- **Applications** — drag-and-drop Kanban board (custom stages) ⇄ fully customizable
  table (column picker persists), slide-over detail drawer with expand-to-full-page.
- **Capture anything** — global `+` / `N`: paste a job URL (parses JSON-LD + OpenGraph),
  paste the posting text (AI extraction with your own Gemini/Anthropic/OpenAI key —
  Gemini's free tier works), or fill the form manually.
- **Interviews, tasks, contacts** — structured interview rounds with outcomes,
  time-grouped tasks with snooze, contacts linked to applications with one-click
  **Apollo.io** recruiter lookup (bring your own key).
- **Analytics** — applications per week vs goal, median days-per-stage velocity, and a
  sankey of where applications flow.
- **Power UX** — ⌘K command palette, keyboard shortcuts (`?` for help), undo toasts
  instead of confirm dialogs, skippable 3-step onboarding.
- **Your data stays yours** — CSV/JSON export, CSV import, archive with restore,
  demo-data seeding you can clear with one click.

## Quick start (local)

```bash
npm install
npm run db:push        # creates local.db (SQLite file)
npm run seed           # optional: 16 demo applications, clearable in Settings
npm run dev
```

Open http://localhost:3000. Without Google credentials configured you get a one-click
**dev mode** login. Set `AUTH_SECRET` in `.env` (`npx auth secret` generates one);
see `.env.example` for everything else.

## Deploy (Vercel + Turso + Google sign-in)

### 1. Database — Turso (free tier)

```bash
brew install tursodatabase/tap/turso   # or: curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup
turso db create job-tracker
turso db show job-tracker --url        # → TURSO_DATABASE_URL
turso db tokens create job-tracker     # → TURSO_AUTH_TOKEN
```

Push the schema to the remote DB:

```bash
TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… npm run db:push
# optional demo data:
TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… npm run seed
```

### 2. Google OAuth

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
   → Create credentials → **OAuth client ID** → Web application.
2. Authorized redirect URIs:
   - `https://<your-app>.vercel.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
3. Copy the client ID/secret.

### 3. Vercel

1. Push this repo to GitHub and import it at [vercel.com/new](https://vercel.com/new).
2. Add environment variables (Project → Settings → Environment Variables):

   | Variable | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | from step 1 |
   | `TURSO_AUTH_TOKEN` | from step 1 |
   | `AUTH_SECRET` | `npx auth secret` |
   | `GOOGLE_CLIENT_ID` | from step 2 |
   | `GOOGLE_CLIENT_SECRET` | from step 2 |
   | `ALLOWED_EMAILS` | your Gmail address (comma-separate to add more) |

3. Deploy. Only allowlisted Google accounts can sign in.

### 4. In-app keys (optional, added during onboarding or in Settings)

- **AI extraction** — a [Gemini API key](https://aistudio.google.com/apikey) (free
  tier) or an Anthropic/OpenAI key. Powers paste-a-posting → autofilled fields.
- **Apollo.io** — an [Apollo API key](https://developer.apollo.io) powers
  "Find contacts" (recruiters/talent at the company) on any application.

These are stored in your own database and used only server-side.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `N` | New application |
| `T` | New task |
| `B` / `L` | Board / list view (on Applications) |
| `1`–`6` | Jump to page |
| `?` | Shortcut help |

## Stack

Next.js 15 (App Router) · Auth.js v5 (Google, email allowlist) · Drizzle ORM ·
Turso/libSQL · Tailwind CSS v4 · dnd-kit · Recharts + d3-sankey · cmdk · sonner

## V2 — automated discovery & outreach

V2 adds a **Discover** page and Gmail automation on top of v1 (all additive — v1
features and data are untouched).

### Job discovery

- **Saved searches** run against Adzuna + JSearch (bring your own free keys),
  Remotive, RemoteOK, and the latest Hacker News "Who is hiring" thread.
- **Company watchlist** polls public Greenhouse/Lever career boards (no keys).
- Matches get an **AI fit score** (0–100 + reasoning) against your target role and
  profile blurb, then land in the Discover inbox: **✓ Add** creates a prefilled
  application (and auto-pulls referral contacts via Apollo), **✕** dismisses.
- Scans run daily via **Vercel Cron** (`vercel.json` is preconfigured — just set a
  `CRON_SECRET` env var) or on demand with **Scan now**.

Free keys: [Adzuna](https://developer.adzuna.com) ·
[JSearch on RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)

### Gmail automation

1. Add `https://<your-app>.vercel.app/api/gmail/callback` (and the localhost
   equivalent) to your Google OAuth client's redirect URIs.
2. Settings → **Connect Gmail** (read-only scanning + draft creation scopes; it is
   your own Google Cloud project, so only allowlisted accounts can connect).
3. Each scan finds recruiter replies/interview invites/rejections for your active
   applications and turns them into **one-click suggestions** on the dashboard —
   move stage, log activity, create a follow-up task. Nothing is applied without
   your click. Optionally restrict scanning to one Gmail label in Settings.

### AI outreach drafts

- **Ask referral** on any contact → a personalized referral request (email +
  LinkedIn DM versions, tone picker), built from your profile blurb + the job.
- **Draft follow-up** on any application → a polite nudge for stale threads.
- One click saves email drafts straight into your Gmail drafts folder.

## Roadmap hooks still open

- **Browser extension** — the same `/api/urlmeta` + `/api/extract` endpoints can
  back a one-click capture extension.
