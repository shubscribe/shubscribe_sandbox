import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const PROMPT = `Extract structured fields from this job posting. Respond with ONLY a JSON object (no markdown fences, no commentary) with these keys (use null when a field is not present):
{
  "title": string|null,          // job title
  "company": string|null,        // company name
  "location": string|null,       // e.g. "San Francisco, CA"
  "workMode": "remote"|"hybrid"|"onsite"|null,
  "jobType": "full-time"|"part-time"|"contract"|"internship"|null,
  "salaryMin": number|null,      // annual, in the posting's currency, as a plain number
  "salaryMax": number|null,
  "currency": string|null,       // ISO code like "USD", "INR"
  "skills": string[]             // up to 6 key skills/technologies mentioned
}

Job posting text:
`;

type Provider = "gemini" | "anthropic" | "openai";

async function callGemini(key: string, text: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT + text }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callAnthropic(key: string, text: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: PROMPT + text }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}`);
  const data = await res.json();
  const block = Array.isArray(data.content)
    ? data.content.find((b: { type: string }) => b.type === "text")
    : null;
  return block?.text ?? "";
}

async function callOpenAI(key: string, text: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: PROMPT + text }],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

const callers: Record<Provider, (key: string, text: string) => Promise<string>> = {
  gemini: callGemini,
  anthropic: callAnthropic,
  openai: callOpenAI,
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await getSettings();
  if (!settings.aiProvider || !settings.aiApiKey) {
    return NextResponse.json(
      { error: "No AI key configured. Add one in Settings → Integrations (Gemini has a free tier)." },
      { status: 400 }
    );
  }

  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "Missing text" }, { status: 400 });

  try {
    const raw = await callers[settings.aiProvider](settings.aiApiKey, text.slice(0, 24000));
    // strip accidental code fences before parsing
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
