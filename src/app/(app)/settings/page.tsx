import { getSettings } from "@/lib/settings";
import { getStages, getSources, getTags, getApplications } from "@/lib/data";
import { SettingsView } from "@/components/settings/SettingsView";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, stages, sources, tags, allApps] = await Promise.all([
    getSettings(),
    getStages(),
    getSources(),
    getTags(),
    getApplications({ includeArchived: true }),
  ]);

  const archived = allApps
    .filter((a) => a.archived)
    .map((a) => ({ id: a.id, company: a.company, title: a.title }));
  const hasDemo = allApps.some((a) => a.demo);

  return (
    <SettingsView
      settings={settings}
      stages={stages}
      sources={sources}
      tags={tags}
      archived={archived}
      hasDemo={hasDemo}
    />
  );
}
