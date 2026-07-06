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
- **v2: automated discovery** — saved searches + company watchlist scanned daily,
  AI fit-scored into a Discover inbox; Gmail scanning turns recruiter replies into
  one-click suggestions ([details](#v2--automated-discovery--outreach)).
- **v3: outreach autopilot** — high-fit jobs auto-added, leads found per persona,
  messages drafted and queued; you approve, it sends from your Gmail with pacing
  and stop rules ([details](#v3--outreach-autopilot)).
- **v4: daily driver** — reply-safe sending, dashboard briefing with inline
  approvals, mobile bottom nav + installable PWA, AI interview prep packs,
  taste-learning fit scores, daily digest email ([details](#v4--the-daily-driver-update)).

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
| `1`–`8` | Jump to page |
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

## V3 — outreach autopilot

V3 turns discovery into a full pipeline: **jobs found → high-fit ones auto-added →
leads pulled → messages drafted → campaign queued → paced sends after YOUR
approval**. Still fully additive — v1 and v2 work unchanged, and nothing is ever
sent without an explicit approve.

### How the autopilot flows

1. Every scan, discovered jobs scoring **≥ your auto-add threshold** (default 75,
   Settings → Outreach autopilot) are added to the pipeline automatically; 50–74
   wait in the Discover inbox; below 50 expire after 14 days.
2. Each auto-added job gets a **campaign**: Apollo finds ~2 leads per persona
   (recruiters, hiring managers, peers with your target title) and the AI drafts
   the first touch for each, personalized from your profile blurb, proof points,
   and parsed resume.
3. Drafts wait in **Outreach → Queue**. Edit inline, **Approve** / **Skip**, or
   approve a whole campaign at once.
4. The **tick** (every ~30 min) releases approved emails inside your send window
   (default 9:00–18:00, max 10/day — both configurable) through **your own
   Gmail**, so they sit in your Sent folder. Step-1 emails attach your default
   resume (override per campaign). Later steps (bump email, LinkedIn-DM task)
   draft themselves after each step's delay and wait for approval too.
5. **Stop rules**: a detected reply stops that lead and surfaces a suggestion;
   moving the application to Interviewing or a terminal stage cancels its pending
   sends; a global pause switch lives in Settings.

You can also start a campaign manually from any application (🚀 **Start
outreach** in the contacts section).

### Setup

- **Reconnect Gmail once** if you connected during v2 — v3 adds the send scope.
- **Requires** an Apollo key (leads) + an AI key (drafts) — same ones from v1/v2.
- **The heartbeat**: GitHub Actions is preconfigured in
  `.github/workflows/tick.yml` (Vercel's free cron only allows daily). Add two
  repo secrets under *Settings → Secrets and variables → Actions*:
  - `APP_URL` — e.g. `https://your-app.vercel.app`
  - `CRON_SECRET` — same value as the Vercel env var
  There's also a **Run tick now** button on the Outreach page.
- **Personalization**: upload a resume (PDF text is parsed into drafts), add
  proof points (one per line), and tune the per-persona sequence in Settings.

### Outreach page

**Queue** (edit/approve/skip drafts) · **Campaigns** (per-company progress,
pause/stop, resume override) · **Analytics** (sends, replies, which persona
actually answers) · **History** (every sent message, linked to its Gmail thread).

## V4 — the daily driver update

V4 is a product pass over v1–v3: tighter trust guarantees, a morning ritual, a
real mobile experience, and features for the moment that matters most — the
interview. All additive, as always.

### Trust guarantees
- **Never bump someone who replied**: every tick re-checks Gmail for replies
  *before* releasing any send. If the reply check fails, sends wait — no risk of
  an embarrassing follow-up landing after an answer.
- **LinkedIn DM steps are one-tap**: the task now carries the full drafted
  message (⧉ Copy) and a direct link to the lead's LinkedIn profile.

### The morning ritual
- **Dashboard briefing** — drafts waiting for approval (approve/skip inline,
  without leaving the dashboard), top new job matches with one-click add, plus
  the existing suggestions, interviews, and due tasks.
- **Setup checklist** — a dismissible card that shows exactly what's configured
  and what each missing key unlocks.
- **Daily digest email** — the morning tick emails you a summary (drafts to
  approve, new matches, tasks due) via your own Gmail, only when something is
  actually waiting. Toggle in Settings → Outreach autopilot. Reconnect Gmail
  once so the app can learn your address.

### Mobile + PWA
- Bottom tab bar on phones (Home / Apps / Discover / Outreach / More) with
  badges, plus a More sheet for the rest.
- Installable: open the site on your phone → "Add to Home Screen" — it runs
  standalone like a native app.

### Interview prep kit
- When an application reaches an interviewing stage, the autopilot generates a
  **prep pack**: company & role brief, likely questions from the JD, which of
  YOUR stories to tell for each, questions to ask, and red flags to avoid.
- Also on demand: **✨ Generate** in the application's "Interview prep" section.
- A "Review prep pack" task lands the day before your next round.

### The machine learns
- **Dismiss with a reason** on Discover (too senior, wrong stack, salary…) —
  future fit scoring reads your last 30 dismissals and scores similar jobs lower.
- **Cross-source dedupe** — the same job from two boards only shows up once.
- **Analytics that answer questions**: which sources convert to interviews
  (not just applications), and whether outreach replies actually turn into
  interviews.

Upgrading from v3? Run `npm run db:push` once (new columns: task notes/links,
application prep packs) and redeploy.

## Roadmap hooks still open

- **Browser extension** — the same `/api/urlmeta` + `/api/extract` endpoints can
  back a one-click capture extension.
