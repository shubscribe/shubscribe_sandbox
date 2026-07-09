import "server-only";
import { db, searches, watchlist, discovered, applications, sources as sourcesTable, stages, activities } from "@/db";
import { eq, and, lt, isNotNull } from "drizzle-orm";
import { getSettings, setSettings } from "./settings";
import { llmJson, hasAiKey } from "./llm";

export type Job = {
  source: string;
  externalId: string;
  company: string;
  title: string;
  url?: string | null;
  location?: string | null;
  remote?: boolean | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  description?: string | null;
  postedAt?: number | null; // epoch ms
};

type Search = typeof searches.$inferSelect;

const UA = { "User-Agent": "MissionControl-JobTracker/2.0 (personal job search tool)" };
const clip = (s: string | null | undefined, n = 4000) => (s ? s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, n) : null);

async function getJson(url: string, timeout = 15000): Promise<unknown> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} → ${res.status}`);
  return res.json();
}

/* ---------------- source fetchers (each returns raw jobs for one search) ---------------- */

async function adzuna(s: Search, appId: string, appKey: string): Promise<Job[]> {
  const params = new URLSearchParams({
    app_id: appId, app_key: appKey,
    what: s.keywords, results_per_page: "20", "content-type": "application/json",
  });
  if (s.location) params.set("where", s.location);
  if (s.salaryMin) params.set("salary_min", String(s.salaryMin));
  const data = (await getJson(`https://api.adzuna.com/v1/api/jobs/us/search/1?${params}`)) as {
    results?: Array<{ id: string; title: string; company?: { display_name?: string }; location?: { display_name?: string }; redirect_url?: string; salary_min?: number; salary_max?: number; description?: string; created?: string }>;
  };
  return (data.results ?? []).map((r) => ({
    source: "adzuna", externalId: String(r.id),
    company: r.company?.display_name ?? "Unknown", title: r.title,
    url: r.redirect_url, location: r.location?.display_name,
    salaryMin: r.salary_min ? Math.round(r.salary_min) : null,
    salaryMax: r.salary_max ? Math.round(r.salary_max) : null,
    currency: "USD", description: clip(r.description),
    postedAt: r.created ? Date.parse(r.created) : null,
  }));
}

async function jsearch(s: Search, key: string): Promise<Job[]> {
  const q = encodeURIComponent(`${s.keywords}${s.location ? ` in ${s.location}` : ""}`);
  const res = await fetch(
    `https://jsearch.p.rapidapi.com/search?query=${q}&num_pages=1${s.remoteOnly ? "&remote_jobs_only=true" : ""}`,
    { headers: { ...UA, "X-RapidAPI-Key": key, "X-RapidAPI-Host": "jsearch.p.rapidapi.com" }, signal: AbortSignal.timeout(20000) }
  );
  if (!res.ok) throw new Error(`jsearch → ${res.status}`);
  const data = (await res.json()) as {
    data?: Array<{ job_id: string; job_title: string; employer_name: string; job_apply_link?: string; job_city?: string; job_state?: string; job_is_remote?: boolean; job_min_salary?: number; job_max_salary?: number; job_salary_currency?: string; job_description?: string; job_posted_at_timestamp?: number }>;
  };
  return (data.data ?? []).map((r) => ({
    source: "jsearch", externalId: r.job_id,
    company: r.employer_name, title: r.job_title, url: r.job_apply_link,
    location: [r.job_city, r.job_state].filter(Boolean).join(", ") || null,
    remote: r.job_is_remote ?? null,
    salaryMin: r.job_min_salary ? Math.round(r.job_min_salary) : null,
    salaryMax: r.job_max_salary ? Math.round(r.job_max_salary) : null,
    currency: r.job_salary_currency ?? null, description: clip(r.job_description),
    postedAt: r.job_posted_at_timestamp ? r.job_posted_at_timestamp * 1000 : null,
  }));
}

async function remotive(s: Search): Promise<Job[]> {
  const data = (await getJson(
    `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(s.keywords)}&limit=20`
  )) as { jobs?: Array<{ id: number; title: string; company_name: string; url: string; candidate_required_location?: string; salary?: string; description?: string; publication_date?: string }> };
  return (data.jobs ?? []).map((r) => ({
    source: "remotive", externalId: String(r.id),
    company: r.company_name, title: r.title, url: r.url,
    location: r.candidate_required_location ?? "Remote", remote: true,
    description: clip(r.description),
    postedAt: r.publication_date ? Date.parse(r.publication_date) : null,
  }));
}

async function remoteok(s: Search): Promise<Job[]> {
  const data = (await getJson("https://remoteok.com/api")) as Array<Record<string, unknown>>;
  const kw = s.keywords.toLowerCase().split(/\s+/).filter(Boolean);
  return data
    .filter((r) => r && typeof r === "object" && r.id && r.position)
    .filter((r) => {
      const hay = `${r.position} ${r.description ?? ""} ${(r.tags as string[] | undefined)?.join(" ") ?? ""}`.toLowerCase();
      return kw.every((k) => hay.includes(k));
    })
    .slice(0, 20)
    .map((r) => ({
      source: "remoteok", externalId: String(r.id),
      company: String(r.company ?? "Unknown"), title: String(r.position),
      url: typeof r.url === "string" ? r.url : null, location: "Remote", remote: true,
      salaryMin: typeof r.salary_min === "number" ? r.salary_min : null,
      salaryMax: typeof r.salary_max === "number" ? r.salary_max : null,
      currency: "USD", description: clip(String(r.description ?? "")),
      postedAt: typeof r.date === "string" ? Date.parse(r.date) : null,
    }));
}

async function hackerNews(s: Search): Promise<Job[]> {
  // find the latest "Who is hiring?" thread, then keyword-search its comments
  const stories = (await getJson(
    "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=5"
  )) as { hits?: Array<{ objectID: string; title: string }> };
  const thread = stories.hits?.find((h) => /who is hiring/i.test(h.title));
  if (!thread) return [];
  const comments = (await getJson(
    `https://hn.algolia.com/api/v1/search?tags=comment,story_${thread.objectID}&query=${encodeURIComponent(s.keywords)}&hitsPerPage=15`
  )) as { hits?: Array<{ objectID: string; comment_text?: string; created_at?: string }> };
  return (comments.hits ?? [])
    .filter((c) => c.comment_text)
    .map((c) => {
      const text = c.comment_text!.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
      const firstLine = text.split(/\n|(?<=\|)\s{2,}/)[0].slice(0, 140);
      const company = firstLine.split("|")[0].trim().slice(0, 60) || "HN posting";
      const title = firstLine.split("|")[1]?.trim().slice(0, 90) ?? "See posting";
      return {
        source: "hn", externalId: c.objectID,
        company, title,
        url: `https://news.ycombinator.com/item?id=${c.objectID}`,
        description: clip(text), location: null,
        postedAt: c.created_at ? Date.parse(c.created_at) : null,
      };
    });
}

async function greenhouseBoard(company: string, slug: string, keywords: string | null): Promise<Job[]> {
  const data = (await getJson(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`
  )) as { jobs?: Array<{ id: number; title: string; absolute_url: string; location?: { name?: string }; updated_at?: string }> };
  const kw = (keywords ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return (data.jobs ?? [])
    .filter((j) => kw.length === 0 || kw.every((k) => j.title.toLowerCase().includes(k)))
    .slice(0, 25)
    .map((j) => ({
      source: "greenhouse", externalId: String(j.id),
      company, title: j.title, url: j.absolute_url,
      location: j.location?.name ?? null,
      postedAt: j.updated_at ? Date.parse(j.updated_at) : null,
    }));
}

async function leverBoard(company: string, slug: string, keywords: string | null): Promise<Job[]> {
  const data = (await getJson(
    `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json&limit=50`
  )) as Array<{ id: string; text: string; hostedUrl: string; categories?: { location?: string; commitment?: string }; createdAt?: number; descriptionPlain?: string }>;
  const kw = (keywords ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return data
    .filter((j) => kw.length === 0 || kw.every((k) => j.text.toLowerCase().includes(k)))
    .slice(0, 25)
    .map((j) => ({
      source: "lever", externalId: j.id,
      company, title: j.text, url: j.hostedUrl,
      location: j.categories?.location ?? null,
      description: clip(j.descriptionPlain), postedAt: j.createdAt ?? null,
    }));
}

/* ---------------- matching + scoring ---------------- */

function matches(job: Job, s: Search): boolean {
  if (s.remoteOnly && job.remote === false) return false;
  if (s.salaryMin && job.salaryMax != null && job.salaryMax < s.salaryMin) return false;
  const kw = s.keywords.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = `${job.title} ${job.description ?? ""}`.toLowerCase();
  return kw.every((k) => hay.includes(k));
}

async function scoreFit(jobs: Job[]): Promise<Map<string, { score: number; reason: string }>> {
  const out = new Map<string, { score: number; reason: string }>();
  if (!(await hasAiKey()) || jobs.length === 0) return out;
  const s = await getSettings();
  const tastes = s.dismissTastes.split("\n").filter(Boolean).slice(-15);
  const prof = parseStoredResumeProfile(s.resumeProfile);
  const profile = [
    s.targetRole && `Target role: ${s.targetRole}`,
    prof?.seniority && `Seniority: ${prof.seniority}`,
    prof?.coreSkills?.length && `Core skills: ${prof.coreSkills.join(", ")}`,
    s.profileBlurb && `About the candidate: ${s.profileBlurb}`,
    s.resumeText && `Résumé excerpt (score for genuine fit including transferable skills, not just keyword overlap):\n${s.resumeText.slice(0, 1800)}`,
    tastes.length &&
      `The candidate dismissed these recently (dismissal reason in parentheses) — score similar jobs lower:\n${tastes.join("\n")}`,
  ].filter(Boolean).join("\n") || "Target role: software engineer";

  for (let i = 0; i < jobs.length; i += 8) {
    const batch = jobs.slice(i, i + 8);
    const listing = batch
      .map((j, n) => `${n}. ${j.title} at ${j.company} | ${j.location ?? "?"} | salary ${j.salaryMin ?? "?"}-${j.salaryMax ?? "?"}\n${(j.description ?? "").slice(0, 400)}`)
      .join("\n---\n");
    try {
      const res = await llmJson<{ scores: { i: number; score: number; reason: string }[] }>(
        `You are scoring job postings for fit against a candidate. ${profile}\n\nJobs:\n${listing}\n\nRespond with ONLY JSON: {"scores":[{"i":<index>,"score":<0-100>,"reason":"<one short sentence>"}]} — one entry per job.`
      );
      for (const r of res.scores ?? []) {
        const j = batch[r.i];
        if (j) out.set(`${j.source}:${j.externalId}`, { score: Math.max(0, Math.min(100, Math.round(r.score))), reason: String(r.reason ?? "").slice(0, 200) });
      }
    } catch {
      // scoring is best-effort; unscored jobs still land in the inbox
    }
  }
  return out;
}

/* ---------------- orchestrator ---------------- */

export type ScanReport = {
  ranAt: string;
  found: number;
  inserted: number;
  sources: { name: string; status: "ok" | "skipped" | "error"; detail?: string; count?: number }[];
};

export async function runScan(): Promise<ScanReport> {
  const s = await getSettings();
  const enabledSearches = (await db.select().from(searches)).filter((x) => x.enabled);
  const watched = await db.select().from(watchlist);
  const report: ScanReport = { ranAt: new Date().toISOString(), found: 0, inserted: 0, sources: [] };
  const all: (Job & { searchId?: string })[] = [];

  const collect = async (name: string, fn: () => Promise<Job[]>) => {
    try {
      const jobs = await fn();
      report.sources.push({ name, status: "ok", count: jobs.length });
      all.push(...jobs);
    } catch (e) {
      report.sources.push({ name, status: "error", detail: e instanceof Error ? e.message : "failed" });
    }
  };

  for (const search of enabledSearches) {
    const tag = (jobs: Job[]) => jobs.filter((j) => matches(j, search)).map((j) => ({ ...j, searchId: search.id }));
    if (s.adzunaAppId && s.adzunaAppKey) {
      await collect(`adzuna:${search.name}`, async () => tag(await adzuna(search, s.adzunaAppId, s.adzunaAppKey)));
    } else report.sources.push({ name: `adzuna:${search.name}`, status: "skipped", detail: "no key" });
    if (s.jsearchKey) {
      await collect(`jsearch:${search.name}`, async () => tag(await jsearch(search, s.jsearchKey)));
    } else report.sources.push({ name: `jsearch:${search.name}`, status: "skipped", detail: "no key" });
    await collect(`remotive:${search.name}`, async () => tag(await remotive(search)));
    await collect(`remoteok:${search.name}`, async () => tag(await remoteok(search)));
    await collect(`hn:${search.name}`, async () => tag(await hackerNews(search)));
  }
  for (const w of watched) {
    const fn = w.ats === "lever" ? leverBoard : greenhouseBoard;
    await collect(`${w.ats}:${w.company}`, () => fn(w.company, w.slug, w.keywords));
  }

  /* dedupe: within batch (by id AND by company+title across sources),
     against previously discovered, against existing applications */
  const jobKey = (company: string, title: string) =>
    `${company.toLowerCase().trim()}|${title.toLowerCase().replace(/\s+/g, " ").trim()}`;
  const seen = new Set<string>();
  const seenJobs = new Set<string>();
  const unique = all.filter((j) => {
    const k = `${j.source}:${j.externalId}`;
    if (seen.has(k) || seenJobs.has(jobKey(j.company, j.title))) return false;
    seen.add(k);
    seenJobs.add(jobKey(j.company, j.title));
    return true;
  });
  const discoveredRows = await db
    .select({ source: discovered.source, externalId: discovered.externalId, company: discovered.company, title: discovered.title })
    .from(discovered);
  const existingDiscovered = new Set(discoveredRows.map((d) => `${d.source}:${d.externalId}`));
  const existingJobKeys = new Set(discoveredRows.map((d) => jobKey(d.company, d.title)));
  const apps = await db.select({ company: applications.company, title: applications.title }).from(applications);
  const appKeys = new Set(apps.map((a) => jobKey(a.company, a.title)));

  const fresh = unique.filter(
    (j) =>
      !existingDiscovered.has(`${j.source}:${j.externalId}`) &&
      !existingJobKeys.has(jobKey(j.company, j.title)) &&
      !appKeys.has(jobKey(j.company, j.title))
  );
  report.found = unique.length;

  const fits = await scoreFit(fresh);
  for (const j of fresh) {
    const fit = fits.get(`${j.source}:${j.externalId}`);
    try {
      await db.insert(discovered).values({
        source: j.source, externalId: j.externalId, searchId: j.searchId ?? null,
        company: j.company, title: j.title, url: j.url ?? null,
        location: j.location ?? null, remote: j.remote ?? null,
        salaryMin: j.salaryMin ?? null, salaryMax: j.salaryMax ?? null,
        currency: j.currency ?? null, description: j.description ?? null,
        postedAt: j.postedAt ? new Date(j.postedAt) : null,
        fitScore: fit?.score ?? null, fitReason: fit?.reason ?? null,
      });
      report.inserted++;
    } catch {
      // unique-index race: already inserted — fine
    }
  }

  await setSettings({ lastScanAt: report.ranAt });
  return report;
}

export async function markDiscovered(id: string, status: "approved" | "dismissed") {
  await db.update(discovered).set({ status }).where(eq(discovered.id, id));
}

const SOURCE_NAME: Record<string, string> = {
  adzuna: "Adzuna", jsearch: "JSearch", remotive: "Remotive", remoteok: "RemoteOK",
  hn: "Hacker News", greenhouse: "Company site", lever: "Company site",
};

/** Turn a discovered job into a pipeline application (shared by manual approve + autopilot). */
export async function approveDiscoveredCore(id: string): Promise<{ applicationId?: string; error?: string }> {
  const [j] = await db.select().from(discovered).where(eq(discovered.id, id));
  if (!j) return { error: "Not found" };

  const sourceName = SOURCE_NAME[j.source] ?? "Other";
  let src = (await db.select().from(sourcesTable)).find((x) => x.name === sourceName);
  if (!src) [src] = await db.insert(sourcesTable).values({ name: sourceName, color: "#5aa9e6" }).returning();
  const firstStage = (await db.select().from(stages)).sort((a, b) => a.position - b.position)[0];

  const [app] = await db.insert(applications).values({
    company: j.company, title: j.title, url: j.url,
    location: j.location, workMode: j.remote ? "remote" : null,
    salaryMin: j.salaryMin, salaryMax: j.salaryMax, currency: j.currency ?? "USD",
    sourceId: src?.id ?? null, stageId: firstStage?.id ?? null,
    jdText: j.description,
  }).returning();

  await db.insert(activities).values({
    applicationId: app.id, type: "created",
    message: `Added ${j.title} at ${j.company} (discovered via ${sourceName})`,
    meta: JSON.stringify({ to: firstStage?.id ?? null }),
  });
  await markDiscovered(id, "approved");
  return { applicationId: app.id };
}

export type AutopilotReport = { autoAdded: number; campaignsCreated: number; expired: number };

/** v3 autopilot: auto-add high-fit jobs (with campaigns), expire stale low-fit ones. */
export async function runAutopilot(): Promise<AutopilotReport> {
  const { getSettings: gs } = await import("./settings");
  const { createCampaign } = await import("./outreach");
  const s = await gs();
  const report: AutopilotReport = { autoAdded: 0, campaignsCreated: 0, expired: 0 };

  const fresh = await db.select().from(discovered).where(eq(discovered.status, "new"));
  for (const j of fresh) {
    if (j.fitScore == null || j.fitScore < s.autoAddThreshold) continue;
    const res = await approveDiscoveredCore(j.id);
    if (!res.applicationId) continue;
    report.autoAdded++;
    const c = await createCampaign(res.applicationId);
    if (c.created) report.campaignsCreated++;
  }

  const cutoff = new Date(Date.now() - 14 * 86400000);
  const stale = await db.select().from(discovered).where(
    and(eq(discovered.status, "new"), isNotNull(discovered.fitScore), lt(discovered.createdAt, cutoff))
  );
  for (const j of stale) {
    if ((j.fitScore ?? 100) < 50) {
      await markDiscovered(j.id, "dismissed");
      report.expired++;
    }
  }
  return report;
}

/* ---------------- résumé-powered discovery (v5) ---------------- */

export type ResumeProfile = {
  targetTitles: string[];
  seniority: string; // intern | junior | mid | senior | staff | lead | principal | director | exec
  coreSkills: string[];
  domains: string[];
  locations: string[];
  remotePref: "remote" | "hybrid" | "onsite" | "any";
  minSalary: number | null;
  yearsExperience: number | null;
};

export function parseStoredResumeProfile(json: string): ResumeProfile | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as Partial<ResumeProfile>;
    return {
      targetTitles: Array.isArray(p.targetTitles) ? p.targetTitles.slice(0, 4) : [],
      seniority: typeof p.seniority === "string" ? p.seniority : "",
      coreSkills: Array.isArray(p.coreSkills) ? p.coreSkills.slice(0, 20) : [],
      domains: Array.isArray(p.domains) ? p.domains.slice(0, 8) : [],
      locations: Array.isArray(p.locations) ? p.locations.slice(0, 5) : [],
      remotePref: (["remote", "hybrid", "onsite", "any"].includes(p.remotePref as string) ? p.remotePref : "any") as ResumeProfile["remotePref"],
      minSalary: typeof p.minSalary === "number" ? p.minSalary : null,
      yearsExperience: typeof p.yearsExperience === "number" ? p.yearsExperience : null,
    };
  } catch {
    return null;
  }
}

/** AI-parse résumé text into a structured, searchable profile. */
export async function parseResumeProfile(text: string): Promise<ResumeProfile | null> {
  if (!(await hasAiKey()) || !text || text.length < 60) return null;
  try {
    const p = await llmJson<ResumeProfile>(
      `Extract a structured, job-search profile from this résumé. Infer 2-3 realistic TARGET job titles
the candidate should search for (their current level and adjacent roles — e.g. a senior React dev →
"Senior Frontend Engineer", "Full Stack Engineer", "Product Engineer"). Pull the strongest, most
searchable skills (technologies/tools), the domains/industries, any locations, remote preference,
a realistic minimum salary for their level (USD, or null), seniority, and total years of experience.

Résumé:
${text.slice(0, 6000)}

Respond ONLY with JSON:
{"targetTitles":["..."],"seniority":"intern|junior|mid|senior|staff|lead|principal|director|exec","coreSkills":["..."],"domains":["..."],"locations":["..."],"remotePref":"remote|hybrid|onsite|any","minSalary":<number|null>,"yearsExperience":<number|null>}`
    );
    return parseStoredResumeProfile(JSON.stringify(p));
  } catch (e) {
    console.error("AI parse error:", e);
    return null;
  }
}

const SENIORITY_RANK: Record<string, number> = {
  intern: 0, junior: 1, mid: 2, senior: 3, staff: 4, lead: 4, principal: 5, director: 6, exec: 7,
};
function titleSeniority(title: string): number | null {
  const t = title.toLowerCase();
  if (/\b(intern|internship)\b/.test(t)) return 0;
  if (/\b(junior|jr\.?|entry|associate|new grad|graduate)\b/.test(t)) return 1;
  if (/\b(principal|distinguished)\b/.test(t)) return 5;
  if (/\b(director|head of)\b/.test(t)) return 6;
  if (/\b(vp|vice president|chief|cto|ceo|svp)\b/.test(t)) return 7;
  if (/\b(staff|lead)\b/.test(t)) return 4;
  if (/\b(senior|sr\.?)\b/.test(t)) return 3;
  return null; // unknown → don't filter out
}
/** True if a job's level is clearly off from the résumé's level (drop it). */
function seniorityMismatch(profileSeniority: string, title: string): boolean {
  const want = SENIORITY_RANK[profileSeniority];
  if (want == null) return false;
  const got = titleSeniority(title);
  if (got == null) return false;
  return Math.abs(got - want) >= 2; // e.g. senior(3) vs intern(0)/director(6)
}

/** Build ad-hoc searches from the résumé profile (one per target title). */
function resumeSearches(prof: ResumeProfile): Search[] {
  const topSkills = prof.coreSkills.slice(0, 2).join(" ");
  const loc = prof.locations[0] ?? null;
  const remoteOnly = prof.remotePref === "remote";
  return prof.targetTitles.slice(0, 3).map((title, i) => ({
    id: `resume-${i}`,
    name: `From your résumé — ${title}`,
    keywords: `${title}${topSkills ? ` ${topSkills}` : ""}`.trim(),
    location: remoteOnly ? null : loc,
    remoteOnly,
    salaryMin: prof.minSalary,
    enabled: true,
    createdAt: new Date(),
  }));
}

/** Run every configured source for one ad-hoc search (best-effort, errors ignored). */
async function collectAllSources(s: Search, settings: Awaited<ReturnType<typeof getSettings>>): Promise<Job[]> {
  const out: Job[] = [];
  const safe = async (fn: () => Promise<Job[]>) => { try { out.push(...await fn()); } catch { /* ignore per-source */ } };
  if (settings.adzunaAppId && settings.adzunaAppKey) await safe(() => adzuna(s, settings.adzunaAppId, settings.adzunaAppKey));
  if (settings.jsearchKey) await safe(() => jsearch(s, settings.jsearchKey));
  await safe(() => remotive(s));
  await safe(() => remoteok(s));
  await safe(() => hackerNews(s));
  return out;
}

export type ResumeDiscoveryReport = { queries: number; found: number; inserted: number; filtered: number; error?: string };

/** Fetch + score jobs against the stored résumé profile, land them in the inbox. */
export async function runResumeDiscovery(searchId?: string): Promise<ResumeDiscoveryReport> {
  const s = await getSettings();
  const report: ResumeDiscoveryReport = { queries: 0, found: 0, inserted: 0, filtered: 0 };
  const prof = parseStoredResumeProfile(s.resumeProfile);
  if (!prof || prof.targetTitles.length === 0) return { ...report, error: "no parsed résumé profile" };

  const queries = resumeSearches(prof);
  report.queries = queries.length;

  const all: Job[] = [];
  for (const q of queries) all.push(...await collectAllSources(q, s));

  // dedupe within batch + against existing discovered + applications
  const jobKey = (company: string, title: string) =>
    `${company.toLowerCase().trim()}|${title.toLowerCase().replace(/\s+/g, " ").trim()}`;
  const seen = new Set<string>();
  const seenJobs = new Set<string>();
  let unique = all.filter((j) => {
    const k = `${j.source}:${j.externalId}`;
    if (seen.has(k) || seenJobs.has(jobKey(j.company, j.title))) return false;
    seen.add(k); seenJobs.add(jobKey(j.company, j.title));
    return true;
  });

  // seniority hard filter (the user's chosen constraint)
  const before = unique.length;
  unique = unique.filter((j) => !seniorityMismatch(prof.seniority, j.title));
  report.filtered = before - unique.length;

  const discoveredRows = await db
    .select({ source: discovered.source, externalId: discovered.externalId, company: discovered.company, title: discovered.title })
    .from(discovered);
  const existingIds = new Set(discoveredRows.map((d) => `${d.source}:${d.externalId}`));
  const existingJobs = new Set(discoveredRows.map((d) => jobKey(d.company, d.title)));
  const apps = await db.select({ company: applications.company, title: applications.title }).from(applications);
  const appKeys = new Set(apps.map((a) => jobKey(a.company, a.title)));

  const fresh = unique.filter(
    (j) => !existingIds.has(`${j.source}:${j.externalId}`) && !existingJobs.has(jobKey(j.company, j.title)) && !appKeys.has(jobKey(j.company, j.title))
  );
  report.found = fresh.length;

  const fits = await scoreFit(fresh);
  for (const j of fresh) {
    const fit = fits.get(`${j.source}:${j.externalId}`);
    try {
      await db.insert(discovered).values({
        source: j.source, externalId: j.externalId, searchId: searchId ?? null,
        company: j.company, title: j.title, url: j.url ?? null,
        location: j.location ?? null, remote: j.remote ?? null,
        salaryMin: j.salaryMin ?? null, salaryMax: j.salaryMax ?? null,
        currency: j.currency ?? null, description: j.description ?? null,
        postedAt: j.postedAt ? new Date(j.postedAt) : null,
        fitScore: fit?.score ?? null, fitReason: fit?.reason ?? null,
      });
      report.inserted++;
    } catch {
      // unique-index race — fine
    }
  }
  return report;
}
