import "server-only";
import { db, settings } from "@/db";

export type AppSettings = {
  name: string;
  targetRole: string;
  weeklyGoal: number;
  staleDays: number;
  onboarded: boolean;
  aiProvider: "gemini" | "anthropic" | "openai" | "openrouter" | "";
  aiApiKey: string;
  aiModel: string; // used by openrouter/openai; blank = provider default
  apolloApiKey: string;
  // email parsing (phase 2 stub)
  emailLabel: string;
  emailMode: "suggest" | "auto";
  // v2: discovery
  adzunaAppId: string;
  adzunaAppKey: string;
  jsearchKey: string;
  profileBlurb: string;
  draftTone: "warm" | "direct" | "formal";
  lastScanAt: string;
  // v2: gmail connection
  gmailConnected: boolean;
  gmailAccessToken: string;
  gmailRefreshToken: string;
  gmailTokenExpiry: string; // epoch ms as string
  lastGmailScanAt: string;
  // v3: outreach automation
  autoAddThreshold: number; // fit score that skips the inbox
  dailySendCap: number;
  sendWindowStart: number; // hour 0-23, local server time
  sendWindowEnd: number;
  outreachPaused: boolean;
  proofPoints: string; // newline-separated wins
  resumeText: string; // parsed text used for personalization
  // v4
  setupDismissed: boolean; // hide the dashboard setup checklist
  dailyDigest: boolean; // morning summary email to self
  lastDigestDay: string; // YYYY-MM-DD of last digest check
  gmailAddress: string; // captured at connect time; digest recipient
  dismissTastes: string; // newline log of "company — title (reason)" dismissals, feeds fit scoring
  // v5: track applications from the inbox
  emailTrackApplications: boolean; // scan inbox for "you applied" emails
  lastInboxScanAt: string; // ISO; empty = first run (90-day backfill)
};

export const DEFAULT_SETTINGS: AppSettings = {
  name: "",
  targetRole: "",
  weeklyGoal: 20,
  staleDays: 5,
  onboarded: false,
  aiProvider: "",
  aiApiKey: "",
  aiModel: "",
  apolloApiKey: "",
  emailLabel: "",
  emailMode: "suggest",
  adzunaAppId: "",
  adzunaAppKey: "",
  jsearchKey: "",
  profileBlurb: "",
  draftTone: "warm",
  lastScanAt: "",
  gmailConnected: false,
  gmailAccessToken: "",
  gmailRefreshToken: "",
  gmailTokenExpiry: "",
  lastGmailScanAt: "",
  autoAddThreshold: 75,
  dailySendCap: 10,
  sendWindowStart: 9,
  sendWindowEnd: 18,
  outreachPaused: false,
  proofPoints: "",
  resumeText: "",
  setupDismissed: false,
  dailyDigest: true,
  lastDigestDay: "",
  gmailAddress: "",
  dismissTastes: "",
  emailTrackApplications: true,
  lastInboxScanAt: "",
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(
      Object.entries(map).map(([k, v]) => {
        if (["weeklyGoal", "staleDays", "autoAddThreshold", "dailySendCap", "sendWindowStart", "sendWindowEnd"].includes(k)) return [k, Number(v)];
        if (["onboarded", "gmailConnected", "outreachPaused", "setupDismissed", "dailyDigest", "emailTrackApplications"].includes(k)) return [k, v === "true"];
        return [k, v];
      })
    ),
  } as AppSettings;
}

export async function setSettings(patch: Partial<AppSettings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    await db
      .insert(settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } });
  }
}
