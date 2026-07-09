import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../../src/db/schema";
import { sql } from "drizzle-orm";

const globalForDb = globalThis as unknown as { __testDb?: ReturnType<typeof make> };

function make() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:test.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

export const db = globalForDb.__testDb ?? (globalForDb.__testDb = make());

/**
 * Empties all tables in the database to start test cases with a clean state.
 */
export async function clearAllTables() {
  await db.run(sql`PRAGMA foreign_keys = OFF;`);

  const tables = [
    schema.outreachMessages,
    schema.leads,
    schema.campaigns,
    schema.resumes,
    schema.sequenceSteps,
    schema.watchlist,
    schema.searches,
    schema.discovered,
    schema.settings,
    schema.activities,
    schema.applicationContacts,
    schema.contacts,
    schema.tasks,
    schema.interviews,
    schema.applicationTags,
    schema.applications,
    schema.tags,
    schema.sources,
    schema.stages,
    schema.suggestions,
    schema.notifications,
  ];

  for (const table of tables) {
    await db.delete(table);
  }

  await db.run(sql`PRAGMA foreign_keys = ON;`);
}
