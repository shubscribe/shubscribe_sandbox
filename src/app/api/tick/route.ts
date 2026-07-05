import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runTick } from "@/lib/outreach";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** The outreach heartbeat: progresses sequences and releases paced sends.
    Hit every ~30 min by the GitHub Action (see .github/workflows/tick.yml). */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronOk = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await runTick();
  return NextResponse.json(report);
}
