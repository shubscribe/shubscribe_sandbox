# Analysis: Notifications Server Actions & Workspace Cleanup

This analysis outlines the patterns found in existing server actions in `src/actions/`, formulates the code for `src/actions/notifications.ts`, and details the cleanup of the temporary verification script `check-schema.ts`.

---

## 1. Patterns in Existing Server Actions

### Database Connection and Usage
- **Import Style**: Database connections and table schemas are imported directly from `@/db`.
  ```typescript
  import { db, applications, activities, applicationTags, stages } from "@/db";
  ```
- **ORM Syntax**: The application utilizes Drizzle ORM to perform operations. Query helpers such as `eq`, `and`, `inArray`, and `desc` are imported from `drizzle-orm`.
- **Query execution**: Operations are executed asynchronously using `await db.<operation>`.

### Caching and Revalidation
- **Next.js Revalidation**: The codebase uses the Next.js `revalidatePath` utility from `next/cache`.
- **Global Helper Pattern**: All investigated server action files (`misc.ts`, `applications.ts`, `discovery.ts`) define a local helper function `revalidate()` that invalidates the root layout:
  ```typescript
  import { revalidatePath } from "next/cache";

  function revalidate() {
    revalidatePath("/", "layout");
  }
  ```
- **Trigger**: Every mutating action (insert, update, delete) calls `revalidate()` right before returning. This invalidates the entire path structure downwards from `/`, forcing a refresh of any cached pages and layouts when a mutation occurs.

### Error Handling & Decorators
- **Use Server Directive**: Every file under `src/actions/` begins with the `"use server";` directive to mark all exports as Next.js Server Actions.
- **Return Types**: Mutating actions that insert rows generally return the generated ID of the new row (e.g. `return row.id;`). Other updates return `void` or a status object such as `{ error: string }`.
- **Error Handling**: Basic errors are allowed to bubble up naturally, except when calling external APIs (e.g. Apollo in `misc.ts`), where `try/catch` wraps the block and returns an error object (e.g. `{ error: error.message }`).

---

## 2. Formulation of `src/actions/notifications.ts`

The following TypeScript code implements the required server actions for notification management. It matches the project's styling and patterns exactly.

```typescript
"use server";

import { db, notifications } from "@/db";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Revalidation helper targeting the root layout.
 * Next.js will revalidate all page components and layouts nested under "/".
 */
function revalidate() {
  revalidatePath("/", "layout");
}

/**
 * Retrieves all notifications ordered by createdAt descending.
 * @returns Promise containing array of notifications.
 */
export async function getNotifications() {
  return db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt));
}

/**
 * Marks a single notification as read.
 * @param id The UUID of the notification.
 */
export async function markAsRead(id: string) {
  await db
    .update(notifications)
    .set({ read: true })
    .where(eq(notifications.id, id));
  revalidate();
}

/**
 * Marks all notifications as read.
 */
export async function markAllAsRead() {
  await db
    .update(notifications)
    .set({ read: true });
  revalidate();
}

/**
 * Deletes all notifications.
 */
export async function clearNotifications() {
  await db
    .delete(notifications);
  revalidate();
}

/**
 * Inserts a new notification and triggers path revalidation on "/".
 * @param title Title of the notification.
 * @param message Message body of the notification.
 * @param linkUrl Optional link URL associated with the notification.
 * @returns The generated UUID of the created notification.
 */
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

---

## 3. Cleanup of `check-schema.ts`

- **Purpose of check-schema.ts**: This script was created in the workspace root as a temporary verification script to query `PRAGMA table_info(notifications)` and verify Drizzle schema migrations.
- **Reference Scan**: A codebase-wide grep scan shows no dependencies on `check-schema.ts` (it is not referenced in `package.json`, build scripts, or imports).
- **Cleanup Recommendation**: The script is now redundant since schema structure and database alignment have been verified. It should be deleted immediately to prevent clutter in the workspace root.
- **Command**:
  ```bash
  rm check-schema.ts
  ```
