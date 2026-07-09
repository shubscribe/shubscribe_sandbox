import "server-only";
import { eq } from "drizzle-orm";
import { db, applications, stages, suggestions } from "@/db";
import { getSettings, setSettings } from "./settings";

const SCOPES = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.send";

export function gmailAuthUrl(origin: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${origin}/api/gmail/callback`,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGmailCode(code: string, origin: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${origin}/api/gmail/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  await setSettings({
    gmailConnected: true,
    gmailAccessToken: data.access_token,
    ...(data.refresh_token ? { gmailRefreshToken: data.refresh_token } : {}),
    gmailTokenExpiry: String(Date.now() + data.expires_in * 1000 - 60000),
  });

  // capture the account's address — the daily digest is sent to it
  try {
    const profile = (await gmailGet("profile")) as { emailAddress?: string };
    if (profile.emailAddress) await setSettings({ gmailAddress: profile.emailAddress });
  } catch {
    // non-fatal; digest simply stays off until a reconnect
  }
}

async function accessToken(): Promise<string> {
  const s = await getSettings();
  if (!s.gmailConnected) throw new Error("Gmail is not connected — connect it in Settings.");
  if (s.gmailAccessToken && Number(s.gmailTokenExpiry) > Date.now()) return s.gmailAccessToken;
  if (!s.gmailRefreshToken) throw new Error("Gmail session expired — reconnect in Settings.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: s.gmailRefreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Gmail token refresh failed (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  await setSettings({
    gmailAccessToken: data.access_token,
    gmailTokenExpiry: String(Date.now() + data.expires_in * 1000 - 60000),
  });
  return data.access_token;
}

export async function gmailSearchMessages(q: string): Promise<{ id: string; threadId: string }[]> {
  const list = (await gmailGet(`messages?q=${encodeURIComponent(q)}&maxResults=10`)) as {
    messages?: { id: string; threadId: string }[];
  };
  return list.messages ?? [];
}

async function gmailGet(path: string): Promise<unknown> {
  const token = await accessToken();
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Gmail API ${path.split("?")[0]} → ${res.status}`);
  return res.json();
}

function buildMime(
  to: string, subject: string, body: string,
  attachment?: { filename: string; mime: string; base64: string }
): string {
  if (!attachment) {
    return Buffer.from(
      `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
    ).toString("base64url");
  }
  const boundary = "mc_" + Math.random().toString(36).slice(2);
  const mime = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
    ``,
    `--${boundary}`,
    `Content-Type: ${attachment.mime}; name="${attachment.filename}"`,
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    attachment.base64,
    `--${boundary}--`,
  ].join("\r\n");
  return Buffer.from(mime).toString("base64url");
}

/** Actually send an email from the connected Gmail account. Returns the thread id. */
export async function sendGmail(
  to: string, subject: string, body: string,
  attachment?: { filename: string; mime: string; base64: string }
): Promise<string> {
  const token = await accessToken();
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: buildMime(to, subject, body, attachment) }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gmail send failed (${res.status}) — reconnect Gmail in Settings if you connected before v3 (new send permission).`);
  const data = (await res.json()) as { threadId?: string };
  return data.threadId ?? "";
}

export async function createGmailDraft(to: string, subject: string, body: string) {
  const token = await accessToken();
  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
  ).toString("base64url");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Draft creation failed (${res.status})`);
}

/* ---------- inbox scan → suggestions ---------- */

const INTERVIEW_RE = /interview|schedule a (call|chat|time)|availability|next round|technical (screen|assessment)|phone screen/i;
const REJECTION_RE = /unfortunately|regret to|not (be )?moving forward|other candidates|decided to (proceed|move forward) with|no longer under consideration/i;

export type GmailScanReport = { scanned: number; suggested: number; error?: string };

export async function scanGmail(): Promise<GmailScanReport> {
  const s = await getSettings();
  if (!s.gmailConnected) return { scanned: 0, suggested: 0, error: "not connected" };

  const apps = (await db.select().from(applications)).filter((a) => !a.archived);
  const allStages = await db.select().from(stages);
  const interviewStage = allStages.find((st) => /interview/i.test(st.name));
  const rejectStage = allStages.find((st) => /reject/i.test(st.name));
  const existing = new Set(
    (await db.select({ t: suggestions.gmailThreadId }).from(suggestions)).map((r) => r.t)
  );

  const label = s.emailLabel ? ` label:${s.emailLabel.replace(/\s+/g, "-")}` : "";
  const list = (await gmailGet(
    `messages?q=${encodeURIComponent(`newer_than:14d -from:me category:primary${label}`)}&maxResults=25`
  )) as { messages?: { id: string; threadId: string }[] };

  let suggested = 0;
  const msgs = list.messages ?? [];
  for (const m of msgs) {
    if (existing.has(m.threadId)) continue;
    const detail = (await gmailGet(
      `messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`
    )) as { snippet?: string; payload?: { headers?: { name: string; value: string }[] } };
    const headers = Object.fromEntries((detail.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]));
    const from = headers.from ?? "";
    const subject = headers.subject ?? "";
    const hay = `${from} ${subject} ${detail.snippet ?? ""}`.toLowerCase();

    const app = apps.find((a) => {
      const name = a.company.toLowerCase();
      return name.length > 2 && hay.includes(name);
    });
    if (!app) continue;

    const text = `${subject} ${detail.snippet ?? ""}`;
    let kind: "interview" | "rejection" | "reply" = "reply";
    if (INTERVIEW_RE.test(text)) kind = "interview";
    else if (REJECTION_RE.test(text)) kind = "rejection";

    await db.insert(suggestions).values({
      applicationId: app.id,
      gmailThreadId: m.threadId,
      subject: subject.slice(0, 200),
      fromAddr: from.slice(0, 200),
      snippet: (detail.snippet ?? "").slice(0, 300),
      kind,
      proposedStageId:
        kind === "interview" && app.stageId !== interviewStage?.id ? (interviewStage?.id ?? null)
        : kind === "rejection" ? (rejectStage?.id ?? null)
        : null,
      proposedTask:
        kind === "interview" ? `Confirm interview time with ${app.company}`
        : kind === "reply" ? `Reply to ${app.company}`
        : null,
    });
    existing.add(m.threadId);
    suggested++;
  }

  // v3: outreach reply detection — stops sequences for leads who wrote back
  try {
    const { detectReplies } = await import("./outreach");
    const replies = await detectReplies(gmailSearchMessages);
    if (replies) suggested += replies;
  } catch {
    // best-effort; regular suggestions above already succeeded
  }

  await setSettings({ lastGmailScanAt: new Date().toISOString() });
  return { scanned: msgs.length, suggested };
}

/* ---------- inbox → applications (v5) ---------- */

// candidate pre-filter — cheap keyword gate before we spend AI calls
const APPLIED_RE = /thank you for (applying|your application)|application (has been )?(received|submitted)|we(?:'ve| have) received your application|your application (to|for|at)|application confirmation|applied to|thanks for your interest in the .* (role|position)|successfully applied/i;
const OFFER_RE = /offer letter|pleased to (extend|offer)|we(?:'d| would) like to offer|job offer|your offer/i;

export type InboxReport = { scanned: number; added: number; suggested: number; loggedReplies: number; error?: string };

type Classified = {
  type: "applied" | "interview" | "rejection" | "offer" | "reply" | "noise";
  company: string;
  role: string;
  confidence: number;
};

/** Scan the inbox for application-lifecycle emails and keep the pipeline in sync:
    auto-add confident new applications, suggest ambiguous ones, and propose
    stage changes for interview/rejection/offer emails on tracked applications. */
export async function scanInboxApplications(): Promise<InboxReport> {
  const s = await getSettings();
  const report: InboxReport = { scanned: 0, added: 0, suggested: 0, loggedReplies: 0 };
  if (!s.gmailConnected) return { ...report, error: "not connected" };
  if (!s.emailTrackApplications) return { ...report, error: "disabled" };

  const days = s.lastInboxScanAt ? 14 : 90; // first run backfills 90 days
  const label = s.emailLabel ? ` label:${s.emailLabel.replace(/\s+/g, "-")}` : "";
  const list = (await gmailGet(
    `messages?q=${encodeURIComponent(`newer_than:${days}d -from:me category:primary${label}`)}&maxResults=60`
  )) as { messages?: { id: string; threadId: string }[] };
  const msgs = list.messages ?? [];
  report.scanned = msgs.length;
  if (!msgs.length) { await setSettings({ lastInboxScanAt: new Date().toISOString() }); return report; }

  // dedupe: threads already turned into apps or suggestions
  const [appRows, sugRows, allStages, allApps] = await Promise.all([
    db.select({ t: applications.emailThreadId }).from(applications),
    db.select({ t: suggestions.gmailThreadId }).from(suggestions),
    db.select().from(stages),
    db.select().from(applications),
  ]);
  const processed = new Set<string>([
    ...appRows.map((r) => r.t).filter(Boolean) as string[],
    ...sugRows.map((r) => r.t).filter(Boolean) as string[],
  ]);
  const activeApps = allApps.filter((a) => !a.archived);

  const stageBy = (re: RegExp) => allStages.find((st) => re.test(st.name));
  const appliedStage = stageBy(/appl/i) ?? [...allStages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
  const interviewStage = stageBy(/interview/i);
  const rejectStage = stageBy(/reject/i);
  const offerStage = stageBy(/offer/i);

  // pull lightweight metadata for un-processed candidate emails
  type Meta = { threadId: string; from: string; subject: string; snippet: string; date: Date };
  const candidates: Meta[] = [];
  for (const m of msgs) {
    if (processed.has(m.threadId)) continue;
    const detail = (await gmailGet(
      `messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`
    )) as { snippet?: string; internalDate?: string; payload?: { headers?: { name: string; value: string }[] } };
    const headers = Object.fromEntries((detail.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]));
    const subject = headers.subject ?? "";
    const snippet = detail.snippet ?? "";
    const hay = `${subject} ${snippet}`;
    // gate: only spend classification on emails that look lifecycle-related
    if (!(APPLIED_RE.test(hay) || OFFER_RE.test(hay) || INTERVIEW_RE.test(hay) || REJECTION_RE.test(hay))) continue;
    candidates.push({
      threadId: m.threadId,
      from: headers.from ?? "",
      subject,
      snippet,
      date: detail.internalDate ? new Date(Number(detail.internalDate)) : new Date(),
    });
    processed.add(m.threadId);
  }
  if (!candidates.length) { await setSettings({ lastInboxScanAt: new Date().toISOString() }); return report; }

  const classifications = await classifyEmails(candidates);

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const cls = classifications[i];
    if (!cls || cls.type === "noise") continue;

    // does this belong to an application we already track?
    const matchName = (cls.company || "").toLowerCase();
    const existing = matchName.length > 2
      ? activeApps.find((a) => a.company.toLowerCase().includes(matchName) || matchName.includes(a.company.toLowerCase()))
      : activeApps.find((a) => a.company.length > 2 && `${c.from} ${c.subject}`.toLowerCase().includes(a.company.toLowerCase()));

    if (cls.type === "applied") {
      if (existing) continue; // already tracked
      const confident = cls.confidence >= 0.7 && !!cls.company;
      if (confident) {
        await autoAddApplication(cls.company, cls.role, c, appliedStage?.id ?? null);
        report.added++;
      } else if (cls.company) {
        await db.insert(suggestions).values({
          gmailThreadId: c.threadId, kind: "applied",
          subject: c.subject.slice(0, 200), fromAddr: c.from.slice(0, 200), snippet: c.snippet.slice(0, 300),
          proposedCompany: cls.company.slice(0, 120), proposedTitle: (cls.role || "Role from email").slice(0, 160),
          proposedStageId: appliedStage?.id ?? null,
        });
        report.suggested++;
      }
      continue;
    }

    // status emails only matter for apps we track
    if (!existing) continue;

    if (cls.type === "reply") {
      // log directly to the timeline — low-risk, keeps the thread's record
      await logActivityDirect(existing.id, "follow_up", `📧 Reply from ${existing.company}: “${c.subject.slice(0, 160)}”`);
      report.loggedReplies++;
      continue;
    }

    const proposedStageId =
      cls.type === "interview" ? (existing.stageId !== interviewStage?.id ? interviewStage?.id ?? null : null)
      : cls.type === "rejection" ? rejectStage?.id ?? null
      : cls.type === "offer" ? offerStage?.id ?? null
      : null;
    await db.insert(suggestions).values({
      applicationId: existing.id, gmailThreadId: c.threadId, kind: cls.type,
      subject: c.subject.slice(0, 200), fromAddr: c.from.slice(0, 200), snippet: c.snippet.slice(0, 300),
      proposedStageId,
      proposedTask:
        cls.type === "interview" ? `Confirm interview time with ${existing.company}`
        : cls.type === "offer" ? `Review offer from ${existing.company}`
        : null,
    });
    report.suggested++;
  }

  await setSettings({ lastInboxScanAt: new Date().toISOString() });
  return report;
}

async function autoAddApplication(
  company: string, role: string, meta: { threadId: string; date: Date },
  stageId: string | null
) {
  const source = await ensureEmailSource();
  const [app] = await db.insert(applications).values({
    company: company.slice(0, 120),
    title: (role || "Role from email").slice(0, 160),
    sourceId: source,
    stageId,
    appliedAt: meta.date,
    emailThreadId: meta.threadId,
    lastActivityAt: meta.date,
  }).returning();
  await logActivityDirect(app.id, "created", `📧 Auto-added from an application email — ${company}`);
}

async function ensureEmailSource(): Promise<string | null> {
  const { sources } = await import("@/db");
  const existing = (await db.select().from(sources)).find((x) => x.name.toLowerCase() === "email");
  if (existing) return existing.id;
  const [row] = await db.insert(sources).values({ name: "Email", color: "#a78bfa" }).returning();
  return row.id;
}

async function logActivityDirect(applicationId: string, type: string, message: string) {
  const { activities } = await import("@/db");
  await db.insert(activities).values({ applicationId, type, message });
  await db.update(applications).set({ lastActivityAt: new Date() }).where(eq(applications.id, applicationId));
}

/** Classify candidate emails. AI when available (batched), else keyword rules. */
async function classifyEmails(items: { from: string; subject: string; snippet: string }[]): Promise<(Classified | null)[]> {
  let hasAi = false;
  try { hasAi = (await import("./llm")).hasAiKey && (await (await import("./llm")).hasAiKey()); } catch { hasAi = false; }

  if (hasAi) {
    try {
      const { llmJson } = await import("./llm");
      const out: (Classified | null)[] = [];
      for (let i = 0; i < items.length; i += 6) {
        const batch = items.slice(i, i + 6);
        const listing = batch.map((e, n) =>
          `${n}. FROM: ${e.from}\nSUBJECT: ${e.subject}\nPREVIEW: ${e.snippet.slice(0, 300)}`
        ).join("\n---\n");
        const res = await llmJson<{ items: { i: number; type: string; company: string; role: string; confidence: number }[] }>(
          `You classify job-search emails for a candidate's application tracker.
For each email decide its type:
- "applied": a confirmation that the candidate submitted an application (e.g. "we received your application").
- "interview": an interview invite / scheduling / assessment request.
- "rejection": a rejection.
- "offer": a job offer.
- "reply": a real human reply from a recruiter/hiring manager that isn't the above.
- "noise": job ALERTS, newsletters, marketing, "jobs for you", digests, or anything that is NOT about a specific application the candidate submitted. When unsure, use "noise".
Extract the hiring company's name (not the job board) and the role title if present.
confidence is 0..1 for how sure you are it's a genuine application-lifecycle email.

Emails:
${listing}

Respond ONLY with JSON: {"items":[{"i":<index>,"type":"...","company":"...","role":"...","confidence":0.0}]} — one per email.`
        );
        const byIdx = new Map((res.items ?? []).map((r) => [r.i, r]));
        for (let n = 0; n < batch.length; n++) {
          const r = byIdx.get(n);
          out.push(r ? {
            type: (["applied", "interview", "rejection", "offer", "reply", "noise"].includes(r.type) ? r.type : "noise") as Classified["type"],
            company: String(r.company ?? "").slice(0, 120),
            role: String(r.role ?? "").slice(0, 160),
            confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0)),
          } : keywordClassify(batch[n]));
        }
      }
      return out;
    } catch {
      // fall through to keyword rules on any AI failure (rate limit, bad model…)
    }
  }
  return items.map(keywordClassify);
}

function keywordClassify(e: { from: string; subject: string; snippet: string }): Classified {
  const hay = `${e.subject} ${e.snippet}`;
  const company = guessCompany(e.from, e.subject);
  if (OFFER_RE.test(hay)) return { type: "offer", company, role: "", confidence: 0.6 };
  if (REJECTION_RE.test(hay)) return { type: "rejection", company, role: "", confidence: 0.6 };
  if (INTERVIEW_RE.test(hay)) return { type: "interview", company, role: "", confidence: 0.6 };
  if (APPLIED_RE.test(hay)) return { type: "applied", company, role: "", confidence: company ? 0.55 : 0.3 };
  return { type: "noise", company: "", role: "", confidence: 0 };
}

function guessCompany(from: string, subject: string): string {
  // "Careers at Acme <no-reply@acme.com>" → Acme; else domain root
  const nameMatch = from.match(/^([^<]+)</);
  const name = nameMatch?.[1]?.replace(/\b(careers|recruiting|talent|noreply|no-reply|jobs|hr|team|hello|hi)\b/gi, "").replace(/[|,·-].*$/, "").trim();
  if (name && name.length > 1 && !/@/.test(name)) return name.slice(0, 60);
  const domain = from.match(/@([a-z0-9.-]+)/i)?.[1] ?? "";
  const root = domain.replace(/\.(com|io|co|org|net|ai|app|jobs)(\.[a-z]{2})?$/i, "").split(".").pop() ?? "";
  if (root && !/(gmail|greenhouse|lever|workday|myworkday|icims|smartrecruiters|ashby|jobvite|taleo)/i.test(root)) {
    return root.charAt(0).toUpperCase() + root.slice(1);
  }
  // recruiting-platform sender: try to lift the company from the subject
  const subj = subject.match(/(?:at|with|to|для|from)\s+([A-Z][A-Za-z0-9&.\- ]{2,40})/)?.[1]?.trim();
  return subj ?? "";
}

export async function disconnectGmail() {
  await setSettings({
    gmailConnected: false, gmailAccessToken: "", gmailRefreshToken: "", gmailTokenExpiry: "",
  });
}
