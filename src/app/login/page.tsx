import { signIn, auth, devLoginEnabled } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="glass w-full max-w-sm p-8 text-center pop-in">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-3xl">
          🚀
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Mission Control</h1>
        <p className="mt-2 text-sm text-ink-dim">
          Your job search, tracked and on target.
        </p>

        <div className="mt-8 space-y-3">
          {devLoginEnabled ? (
            <form
              action={async () => {
                "use server";
                await signIn("dev", { redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
              >
                Continue (dev mode)
              </button>
              <p className="mt-3 text-xs text-ink-faint">
                Google OAuth isn&apos;t configured — set GOOGLE_CLIENT_ID /
                GOOGLE_CLIENT_SECRET to enable Google sign-in.
              </p>
            </form>
          ) : (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" fill="#fff"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" fill="#fff" opacity=".8"/>
                  <path d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" fill="#fff" opacity=".6"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" fill="#fff" opacity=".9"/>
                </svg>
                Sign in with Google
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
