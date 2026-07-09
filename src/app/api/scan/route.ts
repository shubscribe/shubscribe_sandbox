import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runScan, runAutopilot } from "@/lib/discovery";
import { scanGmail, scanInboxApplications } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // discovery + scoring can take a while

export async function GET(req: Request) {
  // allow either a signed-in session (Scan now button) or the Vercel cron secret
  const authHeader = req.headers.get("authorization");
  const cronOk = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const discovery = await runScan();
  const autopilot = await runAutopilot();
  let gmail = null;
  try {
    gmail = await scanGmail();
  } catch (e) {
    gmail = { scanned: 0, suggested: 0, error: e instanceof Error ? e.message : "failed" };
  }
  let inbox = null;
  try {
    inbox = await scanInboxApplications();
  } catch (e) {
    inbox = { scanned: 0, added: 0, suggested: 0, loggedReplies: 0, error: e instanceof Error ? e.message : "failed" };
  }

  return NextResponse.json({ discovery, autopilot, gmail, inbox });
}
