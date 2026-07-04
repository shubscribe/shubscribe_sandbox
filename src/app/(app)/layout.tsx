import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";
import { getStages, getSources, getTags, getApplications } from "@/lib/data";
import { db, discovered, suggestions, outreachMessages } from "@/db";
import { eq } from "drizzle-orm";
import { Sidebar } from "@/components/shell/Sidebar";
import { GlobalUI } from "@/components/shell/GlobalUI";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const settings = await getSettings();
  if (!settings.onboarded) redirect("/onboarding");

  const [stages, sources, tags, apps, newDiscovered, pendingSuggestions, draftedMsgs] = await Promise.all([
    getStages(),
    getSources(),
    getTags(),
    getApplications(),
    db.select({ id: discovered.id }).from(discovered).where(eq(discovered.status, "new")),
    db.select({ id: suggestions.id }).from(suggestions).where(eq(suggestions.status, "pending")),
    db.select({ id: outreachMessages.id }).from(outreachMessages).where(eq(outreachMessages.status, "drafted")),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        name={settings.name || session.user.name || "there"}
        email={session.user.email ?? ""}
        image={session.user.image ?? null}
        discoverCount={newDiscovered.length + pendingSuggestions.length}
        outreachCount={draftedMsgs.length}
      />
      <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-8">{children}</main>
      <GlobalUI
        stages={stages}
        sources={sources}
        tags={tags}
        apps={apps.map((a) => ({ id: a.id, company: a.company, title: a.title }))}
      />
    </div>
  );
}
