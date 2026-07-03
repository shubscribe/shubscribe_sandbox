import "server-only";
import { db, settings } from "@/db";

export type AppSettings = {
  name: string;
  targetRole: string;
  weeklyGoal: number;
  staleDays: number;
  onboarded: boolean;
  aiProvider: "gemini" | "anthropic" | "openai" | "";
  aiApiKey: string;
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
};

export const DEFAULT_SETTINGS: AppSettings = {
  name: "",
  targetRole: "",
  weeklyGoal: 20,
  staleDays: 5,
  onboarded: false,
  aiProvider: "",
  aiApiKey: "",
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
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(
      Object.entries(map).map(([k, v]) => {
        if (k === "weeklyGoal" || k === "staleDays") return [k, Number(v)];
        if (k === "onboarded" || k === "gmailConnected") return [k, v === "true"];
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
