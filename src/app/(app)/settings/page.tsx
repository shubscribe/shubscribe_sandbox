import { getSettings } from "@/lib/settings";
import { getStages, getSources, getTags, getApplications } from "@/lib/data";
import { db, sequenceSteps, resumes } from "@/db";
import { asc } from "drizzle-orm";
import { ensureSequenceSeeded } from "@/lib/outreach";
import { SettingsView } from "@/components/settings/SettingsView";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await ensureSequenceSeeded();

  const [settings, stages, sources, tags, allApps, steps, allResumes] = await Promise.all([
    getSettings(),
    getStages(),
    getSources(),
    getTags(),
    getApplications({ includeArchived: true }),
    db.select().from(sequenceSteps).orderBy(asc(sequenceSteps.persona), asc(sequenceSteps.position)),
    db.select({ id: resumes.id, name: resumes.name, filename: resumes.filename, isDefault: resumes.isDefault })
      .from(resumes),
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
      sequence={steps.map((st) => ({
        id: st.id, persona: st.persona, position: st.position,
        type: st.type, delayDays: st.delayDays, framing: st.framing,
      }))}
      resumes={allResumes}
    />
  );
}
