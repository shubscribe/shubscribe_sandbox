import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { llmJson } from "@/lib/llm";

export const dynamic = "force-dynamic";

const PROMPT = `Extract structured fields from this job posting. Respond with ONLY a JSON object (no markdown fences, no commentary) with these keys (use null when a field is not present):
{
  "title": string|null,
  "company": string|null,
  "location": string|null,          // e.g. "San Francisco, CA"
  "workMode": "remote"|"hybrid"|"onsite"|null,
  "jobType": "full-time"|"part-time"|"contract"|"internship"|null,
  "salaryMin": number|null,         // annual, plain number
  "salaryMax": number|null,
  "currency": string|null,          // ISO code like "USD", "INR"
  "skills": string[]                // up to 6 key skills/technologies mentioned
}

Job posting text:
`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "Missing text" }, { status: 400 });

  try {
    const parsed = await llmJson(PROMPT + text.slice(0, 24000));
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed";
    const status = msg.startsWith("No AI key") ? 400 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
