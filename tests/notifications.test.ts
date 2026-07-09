import "./helpers/next-mock";
import { test } from "node:test";
import assert from "node:assert";
import { db, clearAllTables } from "./helpers/db-helper";
import {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearNotifications,
} from "@/actions/notifications";
import { notifications } from "@/db";

test("Notifications Server Actions", async (t) => {
  await t.test("1. Create and retrieve notifications", async () => {
    await clearAllTables();

    // Create a first notification
    const id1 = await createNotification(
      "Test Title 1",
      "Test Message 1",
      "https://example.com/1"
    );
    assert.ok(id1);

    // Create a second notification without a link
    const id2 = await createNotification(
      "Test Title 2",
      "Test Message 2"
    );
    assert.ok(id2);

    // Retrieve notifications
    const all = await getNotifications();
    assert.strictEqual(all.length, 2);

    // Order should be descending by createdAt (latest first)
    // id2 is created second, so it should be first in the list
    assert.strictEqual(all[0].id, id2);
    assert.strictEqual(all[0].title, "Test Title 2");
    assert.strictEqual(all[0].message, "Test Message 2");
    assert.strictEqual(all[0].linkUrl, null);
    assert.strictEqual(all[0].read, false);

    assert.strictEqual(all[1].id, id1);
    assert.strictEqual(all[1].title, "Test Title 1");
    assert.strictEqual(all[1].message, "Test Message 1");
    assert.strictEqual(all[1].linkUrl, "https://example.com/1");
    assert.strictEqual(all[1].read, false);
  });

  await t.test("2. Mark as read", async () => {
    await clearAllTables();

    const id = await createNotification("Title", "Message");
    
    // Initially unread
    let list = await getNotifications();
    assert.strictEqual(list[0].read, false);

    // Mark as read
    await markAsRead(id);

    // Verify it is read
    list = await getNotifications();
    assert.strictEqual(list[0].read, true);
  });

  await t.test("3. Mark all as read", async () => {
    await clearAllTables();

    await createNotification("T1", "M1");
    await createNotification("T2", "M2");

    let list = await getNotifications();
    assert.strictEqual(list[0].read, false);
    assert.strictEqual(list[1].read, false);

    await markAllAsRead();

    list = await getNotifications();
    assert.strictEqual(list[0].read, true);
    assert.strictEqual(list[1].read, true);
  });

  await t.test("4. Clear notifications", async () => {
    await clearAllTables();

    await createNotification("T1", "M1");
    await createNotification("T2", "M2");

    let list = await getNotifications();
    assert.strictEqual(list.length, 2);

    await clearNotifications();

    list = await getNotifications();
    assert.strictEqual(list.length, 0);
  });
});
