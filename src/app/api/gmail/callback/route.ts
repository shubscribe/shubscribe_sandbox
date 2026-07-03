import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeGmailCode } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  const url = new URL(req.url);
  if (!session?.user) return NextResponse.redirect(new URL("/login", url.origin));

  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/settings?gmail=denied", url.origin));

  try {
    await exchangeGmailCode(code, url.origin);
    return NextResponse.redirect(new URL("/settings?gmail=connected", url.origin));
  } catch {
    return NextResponse.redirect(new URL("/settings?gmail=error", url.origin));
  }
}
