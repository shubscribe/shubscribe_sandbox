"use server";

import { getSettings } from "@/lib/settings";

export type TestResult = { ok: boolean; message: string };

/** Ping the configured AI provider with a trivial prompt. Surfaces the real
    provider error (invalid key, 429 rate limit, bad model id, …). */
export async function testAi(): Promise<TestResult> {
  const s = await getSettings();
  if (!s.aiProvider) return { ok: false, message: "No AI provider selected." };
  if (!s.aiApiKey) return { ok: false, message: "No AI key saved — paste one and click Save first." };
  try {
    const { llm } = await import("@/lib/llm");
    const out = await llm('Reply with exactly the word: pong');
    if (!out || !out.trim()) return { ok: false, message: "Connected, but the model returned nothing — try a different model." };
    const label = s.aiModel ? `${s.aiProvider} · ${s.aiModel}` : s.aiProvider;
    return { ok: true, message: `Working — ${label} replied.` };
  } catch (e) {
    return { ok: false, message: friendly(e) };
  }
}

/** Confirm the Apollo key can run a people search (the endpoint outreach uses). */
export async function testApollo(): Promise<TestResult> {
  const s = await getSettings();
  if (!s.apolloApiKey) return { ok: false, message: "No Apollo key saved — paste one and click Save first." };
  try {
    const res = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": s.apolloApiKey },
      body: JSON.stringify({ q_organization_name: "Google", person_titles: ["recruiter"], page: 1, per_page: 1 }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "Key rejected (401/403). Regenerate it in Apollo → Settings → Integrations → API and make sure it's active." };
    }
    if (res.status === 422) {
      return { ok: false, message: "Apollo says this key's plan can't run people search — that endpoint needs a paid Apollo plan. You can still add contacts manually." };
    }
    if (!res.ok) return { ok: false, message: `Apollo returned ${res.status}. Check your plan/limits.` };
    const data = (await res.json()) as { people?: unknown[]; pagination?: { total_entries?: number } };
    const n = data.pagination?.total_entries ?? data.people?.length ?? 0;
    return { ok: true, message: `Working — search returned results (${n} match${n === 1 ? "" : "es"} for a test query).` };
  } catch (e) {
    return { ok: false, message: friendly(e) };
  }
}

/** Adzuna needs both an app id and key; test the pair. */
export async function testAdzuna(): Promise<TestResult> {
  const s = await getSettings();
  if (!s.adzunaAppId || !s.adzunaAppKey) return { ok: false, message: "Enter and save both the Adzuna App ID and App Key first." };
  try {
    const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=${encodeURIComponent(s.adzunaAppId)}&app_key=${encodeURIComponent(s.adzunaAppKey)}&results_per_page=1&what=engineer`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (res.status === 401 || res.status === 403) return { ok: false, message: "App ID / Key rejected. Double-check both at developer.adzuna.com." };
    if (!res.ok) return { ok: false, message: `Adzuna returned ${res.status}.` };
    return { ok: true, message: "Working — Adzuna accepted your credentials." };
  } catch (e) {
    return { ok: false, message: friendly(e) };
  }
}

/** JSearch (RapidAPI) key. */
export async function testJsearch(): Promise<TestResult> {
  const s = await getSettings();
  if (!s.jsearchKey) return { ok: false, message: "No JSearch key saved — paste one and click Save first." };
  try {
    const res = await fetch("https://jsearch.p.rapidapi.com/search?query=engineer&page=1&num_pages=1", {
      headers: { "X-RapidAPI-Key": s.jsearchKey, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 401 || res.status === 403) return { ok: false, message: "Key rejected. Confirm you're subscribed to JSearch on RapidAPI (free tier is fine)." };
    if (res.status === 429) return { ok: false, message: "Rate-limited (429) — your JSearch free quota is used up for now." };
    if (!res.ok) return { ok: false, message: `JSearch returned ${res.status}.` };
    return { ok: true, message: "Working — JSearch accepted your key." };
  } catch (e) {
    return { ok: false, message: friendly(e) };
  }
}

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/429/.test(msg)) return "Rate limited (429) — the free tier's per-minute cap. Wait ~60s and test again.";
  if (/API_KEY_INVALID|invalid.*key|401|403/i.test(msg)) return "Key rejected — re-copy it (use the site's copy button) and Save again.";
  if (/model/i.test(msg) && /not|invalid|404/i.test(msg)) return "That model id wasn't found — check it against the provider's model list.";
  if (/timeout|timed out|aborted/i.test(msg)) return "Timed out reaching the service. Try again.";
  return msg.slice(0, 240);
}
