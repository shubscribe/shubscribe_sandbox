import { getApplications, getStages, getSources, getTags } from "@/lib/data";
import { ApplicationsView } from "@/components/apps/ApplicationsView";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; open?: string }>;
}) {
  const params = await searchParams;
  const [apps, stages, sources, tags] = await Promise.all([
    getApplications(),
    getStages(),
    getSources(),
    getTags(),
  ]);

  return (
    <ApplicationsView
      apps={apps}
      stages={stages}
      sources={sources}
      tags={tags}
      initialView={params.view === "table" ? "table" : "board"}
      initialOpen={params.open ?? null}
    />
  );
}
