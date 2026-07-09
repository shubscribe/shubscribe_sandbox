## 2026-07-09T04:28:24Z

Your task is:
1. Create and write the file `src/actions/notifications.ts` with the server actions code formulated by the Actions Explorer:
```typescript
"use server";

import { db, notifications } from "@/db";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function revalidate() {
  revalidatePath("/", "layout");
}

export async function getNotifications() {
  return db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt));
}

export async function markAsRead(id: string) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, id));
  revalidate();
}

export async function markAllAsRead() {
  await db
    .update(notifications)
    .set({ read: true });
  revalidate();
}

export async function clearNotifications() {
  await db
    .delete(notifications);
  revalidate();
}

export async function createNotification(
  title: string,
  message: string,
  linkUrl?: string
) {
  const [row] = await db
    .insert(notifications)
    .values({
      title,
      message,
      linkUrl: linkUrl || null,
      read: false,
    })
    .returning();
  revalidate();
  return row.id;
}
```
2. Remove the temporary file `check-schema.ts` from the workspace root.
3. Verify that the project builds successfully by running `npm run build`.
4. Write your findings and verification results to `/Users/shub/.gemini/antigravity/scratch/shubscribe_v2/.agents/worker_m2/handoff.md` and send a handoff message to your parent.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
