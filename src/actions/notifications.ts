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
