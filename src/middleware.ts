import { auth } from "@/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (pathname === "/login") return;
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    return Response.redirect(url);
  }
});

export const config = {
  // api/scan and api/tick guard themselves with CRON_SECRET (or a session)
  matcher: [
    "/((?!api/auth|api/scan|api/tick|_next/static|_next/image|favicon.ico|icon.svg|manifest.json|icon-192.png|icon-512.png|apple-touch-icon.png).*)",
  ],
};
