import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { gmailAuthUrl } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: "Google OAuth is not configured (GOOGLE_CLIENT_ID missing)." },
      { status: 400 }
    );
  }
  return NextResponse.redirect(gmailAuthUrl(new URL(req.url).origin));
}
