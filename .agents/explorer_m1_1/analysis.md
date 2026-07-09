# E2E Test Suite & Mock Strategy Analysis

This analysis outlines the proposal for setting up a test runner and a mocking strategy for the `shubscribe_v2` project.

---

## 1. Node.js Version & Native Test Runner Support

### Findings
- **Target Node.js Version**: The project is configured for Node.js `^20` as indicated by the `@types/node` dependency in `package.json`.
- **Built-in Test Runner (`node:test`)**: 
  - Yes, Node.js has a built-in, native test runner available via `node:test` (stable since Node.js v20.0.0).
  - Assertions are provided by the native `node:assert` module.
  - Since Node.js v20 is the baseline environment, the native test runner is **fully supported and available** without installing heavy third-party testing frameworks (such as Jest or Vitest).

---

## 2. TypeScript Test Execution with `tsx`

### Findings & Strategy
- The project already has `"tsx": "^4.22.5"` as a devDependency in `package.json`.
- `tsx` (TypeScript Execute) supports executing TypeScript files and registering a loader/import hook directly.
- **Alias Resolution**: `tsx` automatically reads and respects path mappings defined in `tsconfig.json` (such as `"@/*": ["./src/*"]`). This allows test files to import modules using the `@/` prefix without requiring external alias-resolver packages.
- **Execution Command**:
  TypeScript tests can be run using the `--import` flag to register `tsx` for module loading, and the `--test` flag to invoke the test runner:
  ```bash
  node --import tsx --test tests/**/*.test.ts
  ```

---

## 3. Database Isolation Strategy (Local Test SQLite)

### Findings
- In `src/db/index.ts`, the database client is initialized via:
  ```typescript
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  ```
- **Local Test DB (`test.db`) Setup**:
  To ensure tests do not pollute or modify `local.db`, we will redirect Drizzle ORM to a separate SQLite database file `test.db`.
  1. **Isolate with Environment Variables**: Run all tests with `TURSO_DATABASE_URL=file:test.db`.
  2. **Schema Push**: Since `shubscribe_v2` uses `drizzle-kit push` for pushing schemas (without static SQL migration files), we can push the schema to `test.db` before running tests.
  3. **Teardown**: A test setup/cleanup script should delete `test.db` and its journal file after tests complete.

### Implementation Script & Config
Add the following scripts to `package.json`:
```json
"scripts": {
  "test:db-setup": "TURSO_DATABASE_URL=file:test.db drizzle-kit push",
  "test:run": "TURSO_DATABASE_URL=file:test.db node --import tsx --test tests/**/*.test.ts",
  "test:db-cleanup": "node -e \"const fs = require('fs'); ['test.db', 'test.db-journal'].forEach(f => fs.existsSync(f) && fs.unlinkSync(f))\"",
  "test": "npm run test:db-setup && (npm run test:run; status=$?; npm run test:db-cleanup; exit $status)"
}
```

---

## 4. Testing Next.js Server Actions & Components (Opaque-box)

### Server Actions
- Server Actions (e.g., `src/actions/applications.ts`) are async server-side functions.
- In tests, they can be imported and executed like normal JS functions.
- **Caveat**: They call Next.js router/cache helpers like `revalidatePath`. Outside of a running Next.js server runtime, these utilities throw errors.
- **Mocking Next.js Utilities**:
  Use `node:test`'s mocking features to mock Next.js imports (`next/cache` and `next/navigation`):
  ```typescript
  import { mock } from "node:test";

  // Mock revalidatePath to avoid errors outside Next.js server context
  mock.module("next/cache", {
    namedExports: {
      revalidatePath: () => {},
    },
  });
  ```

### UI Components (Opaque-box)
To test UI components (like `BottomNav.tsx` or `Sidebar.tsx`) and verify conditional classes based on the current pathname without full browser overhead, we can use two primary strategies:

1. **Happy-dom / JSDOM Environment**:
   Initialize a virtual DOM environment, mock `next/navigation`'s hooks (`usePathname`), and render the component using `@testing-library/react`.
2. **Static HTML String Parsing**:
   A lighter, faster, zero-dependency approach. Render components to a static string using `react-dom/server`'s `renderToString` and query the structure.
   ```typescript
   import { renderToString } from "react-dom/server";
   import { BottomNav } from "@/components/shell/BottomNav";

   // Mock the usePathname hook
   mock.module("next/navigation", {
     namedExports: {
       usePathname: () => "/applications",
     },
   });
   ```

---

## 5. Gmail Sync API Mock Strategy

### Findings
- The Gmail sync logic in `src/lib/gmail.ts` connects via Google OAuth and communicates with Gmail APIs using `fetch`.
- Endpoint targets:
  - `https://oauth2.googleapis.com/token`
  - `https://gmail.googleapis.com/gmail/v1/users/me/*`
- Since native `globalThis.fetch` is used in Node 20+, we can mock network calls directly at the global fetch level.

### Mock implementation using native `globalThis.fetch` override:
```typescript
import { mock } from "node:test";

export function setupGmailMocks() {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url = input.toString();

    // Mock Google OAuth token exchanges
    if (url.includes("oauth2.googleapis.com/token")) {
      return new Response(
        JSON.stringify({
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Mock Gmail message searches
    if (url.includes("gmail.googleapis.com/gmail/v1/users/me/messages")) {
      // Message detail request (messages/id)
      if (url.match(/messages\/\w+/)) {
        return new Response(
          JSON.stringify({
            id: "msg123",
            threadId: "thread123",
            snippet: "Thank you for applying to Acme Corp for the Frontend Role!",
            payload: {
              headers: [
                { name: "From", value: "recruiting@acme.com" },
                { name: "Subject", value: "Application Confirmation - Frontend Role" },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Message search list request
      return new Response(
        JSON.stringify({
          messages: [{ id: "msg123", threadId: "thread123" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    return originalFetch(input, init);
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}
```

---

## 6. Asserting CSS Classes & Navigation Highlighting

### Findings
- The Apple-style mobile floating tab bar `.liquid-bar` is defined in `src/app/globals.css`:
  ```css
  .liquid-bar {
    background: color-mix(in oklab, var(--raised) 82%, transparent);
    backdrop-filter: blur(34px) saturate(2);
    /* ... */
  }
  ```
- Component `BottomNav.tsx` conditionally styles the active tab text:
  - Active: `text-accent`
  - Inactive: `text-ink-faint`

### Assertions in Node.js Native Test
Below are example assertions using `node:test` and simple DOM parsing:

```typescript
import assert from "node:assert";
import { test } from "node:test";
import { renderToString } from "react-dom/server";
import { BottomNav } from "@/components/shell/BottomNav";

// Example test case asserting custom tailwind rendering class and navigation highlighting
test("BottomNav - custom styles and active states", () => {
  // Render BottomNav to HTML string (e.g. pathname mocked to "/applications")
  const html = renderToString(BottomNav({ discoverCount: 2 }));

  // 1. Assert custom Tailwind class .liquid-bar is present in container
  assert.match(html, /class="[^"]*liquid-bar[^"]*"/, "BottomNav container must include liquid-bar class");

  // 2. Assert active nav highlighting
  // Links: "/" (Home), "/applications" (Apps), "/discover" (Discover), "/outreach" (Outreach)
  // When path is mocked to "/applications":
  // Inactive Home Link should have text-ink-faint class
  assert.match(
    html,
    /href="\/".*class="[^"]*text-ink-faint[^"]*"/,
    "Inactive Home link should have text-ink-faint styling"
  );

  // Active Applications Link should have text-accent class
  assert.match(
    html,
    /href="\/applications".*class="[^"]*text-accent[^"]*"/,
    "Active Applications link should have text-accent styling"
  );
});
```

---

## 7. Recommended Test Suite Structure

A clean, modular directory structure for the test suite under a `tests/` directory:

```
tests/
├── helpers/
│   ├── db-helper.ts         # Setup and teardown test DB connections/cleanup
│   └── gmail-mock.ts        # Global fetch interceptors for Gmail API response mocking
├── components/
│   └── BottomNav.test.ts    # Component-level layout & class assertion tests
├── actions/
│   └── applications.test.ts # Server Action integration tests (against test.db)
└── routes/
    └── scan.test.ts         # Scan route E2E integration test (mocks fetch + DB)
```
