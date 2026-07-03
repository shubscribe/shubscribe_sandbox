import Link from "next/link";
import { notFound } from "next/navigation";
import { getApplication, getStages, getSources, getTags } from "@/lib/data";
import { FullPageDetail } from "@/components/apps/FullPageDetail";

export const dynamic = "force-dynamic";

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [app, stages, sources, tags] = await Promise.all([
    getApplication(id),
    getStages(),
    getSources(),
    getTags(),
  ]);
  if (!app) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/applications" className="mb-4 inline-block text-xs text-ink-faint hover:text-ink">
        ← Back to applications
      </Link>
      <div className="glass p-6">
        <FullPageDetail app={app} stages={stages} sources={sources} tags={tags} />
      </div>
    </div>
  );
}
