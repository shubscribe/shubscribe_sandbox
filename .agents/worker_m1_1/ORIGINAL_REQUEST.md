## 2026-07-08T21:30:12-07:00

You are teamwork_preview_worker. Your working directory is /Users/shub/.gemini/antigravity/scratch/shubscribe_v2/.agents/worker_m1_1.
Your task is to set up the E2E Test Infrastructure for the shubscribe_v2 project.
Specifically, perform the following actions:
1. Update `package.json` to include the following test scripts:
   - "test:db-setup": "TURSO_DATABASE_URL=file:test.db drizzle-kit push"
   - "test:run": "TURSO_DATABASE_URL=file:test.db node --import tsx --test tests/**/*.test.ts"
   - "test:db-cleanup": "node -e \"const fs = require('fs'); ['test.db', 'test.db-journal'].forEach(f => fs.existsSync(f) && fs.unlinkSync(f))\""
   - "test": "npm run test:db-setup && (npm run test:run; status=$?; npm run test:db-cleanup; exit $status)"
2. Create the `tests/` directory and `tests/helpers/` subdirectory.
3. Create `tests/helpers/db-helper.ts` to:
   - Export a drizzle database instance configured with a connection to `test.db` (using the same structure as `src/db/index.ts`).
   - Export helper functions to empty all tables in the database so that test cases start with a clean state.
4. Create `tests/helpers/gmail-mock.ts` to intercept `globalThis.fetch` calls and mock the Google OAuth and Gmail REST API endpoints for token exchange, listing messages, and retrieving message details.
5. Create `tests/helpers/next-mock.ts` to mock `next/cache` and other Next.js specific modules that fail outside the Next.js runtime context.
6. Create a simple verification test `tests/sanity.test.ts` using `node:test` and `node:assert` to ensure that tests compile, the environment variable `TURSO_DATABASE_URL` is set, and the test runner completes successfully.
7. Execute `npm run test` and document the output in your handoff report.
8. Do NOT write or modify any product/application code; focus solely on the test suite.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your handoff report to /Users/shub/.gemini/antigravity/scratch/shubscribe_v2/.agents/worker_m1_1/handoff.md. When done, send a message to parent d79e9ef2-c037-4451-95a4-0aee7da556b9.
