import "server-only";
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

export async function disconnectGmail() {
  await setSettings({
    gmailConnected: false, gmailAccessToken: "", gmailRefreshToken: "", gmailTokenExpiry: "",
  });
}
