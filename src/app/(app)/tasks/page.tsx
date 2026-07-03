import { db, tasks as tasksTable } from "@/db";
import { asc } from "drizzle-orm";
import { getApplications } from "@/lib/data";
import { TasksView } from "@/components/tasks/TasksView";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [allTasks, apps] = await Promise.all([
    db.select().from(tasksTable).orderBy(asc(tasksTable.dueAt)),
    getApplications(),
  ]);

  return (
    <TasksView
      tasks={allTasks}
      apps={apps.map((a) => ({ id: a.id, company: a.company, title: a.title }))}
    />
  );
}
