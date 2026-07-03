import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, applications, stages, sources, tags, applicationTags, interviews, tasks, contacts, applicationContacts, activities } from "@/db";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = new URL(req.url).searchParams.get("format") ?? "json";

  const [apps, allStages, allSources, allTags, tagLinks, ivs, allTasks, allContacts, contactLinks, acts] =
    await Promise.all([
      db.select().from(applications),
      db.select().from(stages),
      db.select().from(sources),
      db.select().from(tags),
      db.select().from(applicationTags),
      db.select().from(interviews),
      db.select().from(tasks),
      db.select().from(contacts),
      db.select().from(applicationContacts),
      db.select().from(activities),
    ]);

  if (format === "csv") {
    const stageMap = new Map(allStages.map((s) => [s.id, s.name]));
    const sourceMap = new Map(allSources.map((s) => [s.id, s.name]));
    const header = [
      "company", "title", "stage", "url", "location", "workMode", "jobType",
      "salaryMin", "salaryMax", "salaryAsk", "currency", "source", "referrer",
      "excitement", "appliedAt", "archived", "notes",
    ];
    const lines = [header.join(",")];
    for (const a of apps) {
      lines.push(
        [
          a.company, a.title, a.stageId ? stageMap.get(a.stageId) : "", a.url,
          a.location, a.workMode, a.jobType, a.salaryMin, a.salaryMax, a.salaryAsk,
          a.currency, a.sourceId ? sourceMap.get(a.sourceId) : "", a.referrer,
          a.excitement, a.appliedAt?.toISOString().slice(0, 10), a.archived, a.notes,
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="applications-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return new NextResponse(
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        applications: apps,
        stages: allStages,
        sources: allSources,
        tags: allTags,
        applicationTags: tagLinks,
        interviews: ivs,
        tasks: allTasks,
        contacts: allContacts,
        applicationContacts: contactLinks,
        activities: acts,
      },
      null,
      2
    ),
    {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="job-tracker-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    }
  );
}
