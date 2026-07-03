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
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    ...DEFAULT_SETTINGS,
    ...Object.fromEntries(
      Object.entries(map).map(([k, v]) => {
        if (k === "weeklyGoal" || k === "staleDays") return [k, Number(v)];
        if (k === "onboarded") return [k, v === "true"];
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
