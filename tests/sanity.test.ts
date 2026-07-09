import "./helpers/next-mock";
import "./helpers/gmail-mock";
import { test } from "node:test";
import assert from "node:assert";
import { db, clearAllTables } from "./helpers/db-helper";
import { mockState, resetMockState } from "./helpers/gmail-mock";
import { stages, suggestions, settings, sources } from "@/db";
import { NextResponse } from "next/server";
import { scanInboxApplications } from "@/lib/gmail";

test("E2E Test Infrastructure - Sanity Verification", async (t) => {
  await t.test("1. Environment variables and Next.js mocks", () => {
    assert.strictEqual(process.env.TURSO_DATABASE_URL, "file:test.db");
    
    // Verify NextResponse json mock
    const res = NextResponse.json({ success: true });
    assert.strictEqual(res.status, 200);
  });

  await t.test("2. Database Helper clearAllTables and CRUD", async () => {
    await clearAllTables();

    // Verify database starts empty
    const allStages = await db.select().from(stages);
    assert.strictEqual(allStages.length, 0);

    // Insert a stage
    const [inserted] = await db.insert(stages).values({
      name: "Saved",
      color: "#9aa5c9",
      position: 0,
      isTerminal: false,
    }).returning();

    assert.ok(inserted.id);
    assert.strictEqual(inserted.name, "Saved");

    // Clear and verify empty
    await clearAllTables();
    const allStagesAfterClear = await db.select().from(stages);
    assert.strictEqual(allStagesAfterClear.length, 0);
  });

  await t.test("3. Gmail & OAuth Mock with Application Integration", async () => {
    await clearAllTables();
    resetMockState();

    // 1. Seed necessary DB setup for Gmail scan
    // Seed default settings to enable Gmail connection and tracking
    await db.insert(settings).values([
      { key: "gmailConnected", value: "true" },
      { key: "gmailAccessToken", value: "mock-access-token-abc" },
      { key: "gmailTokenExpiry", value: String(Date.now() + 3600000) },
      { key: "gmailRefreshToken", value: "mock-refresh-token-xyz" },
      { key: "emailTrackApplications", value: "true" },
      { key: "lastInboxScanAt", value: "" }, // empty triggers full scan
    ]);

    // Seed default stages
    await db.insert(stages).values([
      { name: "Applied", color: "#8b8bf5", position: 0, isTerminal: false },
      { name: "Interviewing", color: "#e09b3d", position: 1, isTerminal: false },
      { name: "Rejected", color: "#ef6292", position: 2, isTerminal: true },
    ]);

    // Seed a source
    await db.insert(sources).values({
      name: "Email",
      color: "#a78bfa",
    });

    // 2. Set up mock Gmail inbox data
    mockState.messages.push({
      id: "thread1",
      threadId: "thread1",
      snippet: "We have received your application for the Software Engineer role.",
      from: "Careers at Stripe <recruiting@stripe.com>",
      subject: "Application Confirmation - Stripe",
      internalDate: String(Date.now()),
    });

    // 3. Trigger scanInboxApplications from the application codebase
    const report = await scanInboxApplications();

    // Assert scanned messages count
    assert.strictEqual(report.scanned, 1);
    
    // In our mock environment without AI credentials, it will fall back to the keyword classifier.
    // The keyword classifier guesses the company is "Stripe" and type is "applied" (due to "received your application").
    // Since confidence for "applied" with guessed company is 0.55, it is below the autoAddThreshold (default 0.75 / 75),
    // meaning it should create a suggestion in the database.
    const allSuggestions = await db.select().from(suggestions);
    assert.strictEqual(allSuggestions.length, 1);
    assert.strictEqual(allSuggestions[0].proposedCompany, "at Stripe");
    assert.strictEqual(allSuggestions[0].proposedTitle, "Role from email");
    assert.strictEqual(allSuggestions[0].kind, "applied");
  });
});
