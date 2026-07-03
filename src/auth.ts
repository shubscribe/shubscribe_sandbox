import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const hasGoogle = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const providers: NextAuthConfig["providers"] = [];

if (hasGoogle) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
} else {
  // Local development fallback when Google OAuth isn't configured yet.
  providers.push(
    Credentials({
      id: "dev",
      name: "Development",
      credentials: {},
      async authorize() {
        if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_LOGIN !== "true") {
          return null;
        }
        return { id: "dev-user", name: "Dev User", email: "dev@localhost" };
      },
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    signIn({ user, account }) {
      if (account?.provider === "dev") return true;
      const email = user.email?.toLowerCase();
      if (!email) return false;
      if (allowedEmails.length === 0) return true; // no allowlist configured yet
      return allowedEmails.includes(email);
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
});

export const devLoginEnabled = !hasGoogle;
