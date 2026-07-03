import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSettings } from "@/lib/settings";
import { getStages, getSources, getTags, getApplications } from "@/lib/data";
import { Sidebar } from "@/components/shell/Sidebar";
import { GlobalUI } from "@/components/shell/GlobalUI";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const settings = await getSettings();
  if (!settings.onboarded) redirect("/onboarding");

  const [stages, sources, tags, apps] = await Promise.all([
    getStages(),
    getSources(),
    getTags(),
    getApplications(),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        name={settings.name || session.user.name || "there"}
        email={session.user.email ?? ""}
        image={session.user.image ?? null}
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
