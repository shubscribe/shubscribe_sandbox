## 2026-07-09T04:27:26Z
You are teamwork_preview_explorer. Your working directory is /Users/shub/.gemini/antigravity/scratch/shubscribe_v2/.agents/explorer_m2.
Your task is:
1. Check the existing server actions in `src/actions/` (e.g. `applications.ts`, `misc.ts`) to understand:
   - How database connections are imported and used.
   - How `revalidatePath` or `revalidateTag` is used for Next.js caching/revalidation.
   - Any common error handling, return types, or decorators used (like "use server" at the top of the file).
2. Formulate the precise typescript code for `src/actions/notifications.ts` implementing the following functions:
   - `getNotifications()` - retrieves all notifications ordered by `createdAt` descending.
   - `markAsRead(id: string)` - marks a single notification as read.
   - `markAllAsRead()` - marks all notifications as read.
   - `clearNotifications()` - deletes all notifications.
   - `createNotification(title: string, message: string, linkUrl?: string)` - inserts a new notification and triggers path/tag revalidation (specifically, find which paths should be revalidated, e.g. path "/").
3. Recommend how to clean up the temporary verification file `check-schema.ts` in the workspace root.
Write your analysis to `/Users/shub/.gemini/antigravity/scratch/shubscribe_v2/.agents/explorer_m2/analysis.md` and send a handoff message to your parent.
