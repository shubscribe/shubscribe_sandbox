"use server";

import { db, notifications } from "@/db";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function revalidate() {
  revalidatePath("/", "layout");
}

/**
 * Retrieves all notifications ordered by createdAt descending.
 */
export async function getNotifications() {
  return db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt));
}

/**
 * Marks a single notification as read.
 * @param id The ID of the notification to mark as read.
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
 * Inserts a new notification and triggers path/tag revalidation.
 * @param title The title of the notification.
 * @param message The message body of the notification.
 * @param linkUrl Optional link URL for the notification.
 * @returns The generated ID of the created notification.
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
