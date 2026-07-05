import "server-only";
import { getSettings } from "./settings";

type Provider = "gemini" | "anthropic" | "openai";

async function callGemini(key: string, prompt: string, json: boolean): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          ...(json ? { responseMimeType: "application/json" } : {}),
          temperature: json ? 0 : 0.7,
        },
      }),
      signal: AbortSignal.timeout(45000),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callAnthropic(key: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}`);
  const data = await res.json();
  const block = Array.isArray(data.content)
    ? data.content.find((b: { type: string }) => b.type === "text")
    : null;
  return block?.text ?? "";
}

async function callOpenAI(key: string, prompt: string, json: boolean): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      ...(json ? { response_format: { type: "json_object" } } : {}),
      temperature: json ? 0 : 0.7,
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Run a prompt with the user's configured provider. Throws if no key configured. */
export async function llm(prompt: string, opts?: { json?: boolean }): Promise<string> {
  const s = await getSettings();
  if (!s.aiProvider || !s.aiApiKey) {
    throw new Error("No AI key configured — add one in Settings → Integrations (Gemini has a free tier).");
  }
  const json = opts?.json ?? false;
  const provider = s.aiProvider as Provider;
  if (provider === "gemini") return callGemini(s.aiApiKey, prompt, json);
  if (provider === "anthropic") return callAnthropic(s.aiApiKey, prompt);
  return callOpenAI(s.aiApiKey, prompt, json);
}

/** llm() + strip code fences + JSON.parse */
export async function llmJson<T>(prompt: string): Promise<T> {
  const raw = await llm(prompt, { json: true });
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned) as T;
}

export async function hasAiKey(): Promise<boolean> {
  const s = await getSettings();
  return !!(s.aiProvider && s.aiApiKey);
}
