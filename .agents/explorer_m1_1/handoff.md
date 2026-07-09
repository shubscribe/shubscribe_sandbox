# Handoff Report — E2E Test Runner Setup & Mock Strategy

## 1. Observation
I directly observed the following from the codebase:
* **Node.js Environment**: `package.json` (lines 37, 44) specifies:
  ```json
  "@types/node": "^20",
  "tsx": "^4.22.5"
  ```
* **Database Setup**: `src/db/index.ts` (lines 8-11) initializes the database connection using:
  ```typescript
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  ```
* **Next.js Server Actions**: `src/actions/applications.ts` (line 1, 8) uses `"use server"` and calls Next.js caching methods:
  ```typescript
  "use server";
  ...
  revalidatePath("/", "layout");
  ```
* **Gmail API Integrations**: `src/lib/gmail.ts` connects to Google OAuth and Gmail REST endpoints using global `fetch` calls, such as:
  ```typescript
  await fetch("https://oauth2.googleapis.com/token", { ... })
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { ... })
  ```
* **UI Elements and Tailwind CSS**: `src/components/shell/BottomNav.tsx` (lines 104-106) renders the floating container using `.liquid-bar`:
  ```typescript
  <nav className="liquid-bar fixed inset-x-3 bottom-3 z-40 flex items-stretch justify-around ..." />
  ```
  Active navigation highlighting relies on checking if the tab `href` matches the pathname:
  ```typescript
  const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
  // and dynamically rendering class names using cn()
  active ? "text-accent" : "text-ink-faint active:scale-95"
  ```
* **Custom CSS Rules**: `src/app/globals.css` (lines 162-165) defines `.liquid-bar`:
  ```css
  .liquid-bar {
    background: color-mix(in oklab, var(--raised) 82%, transparent);
    backdrop-filter: blur(34px) saturate(2);
    -webkit-backdrop-filter: blur(34px) saturate(2);
  ```
* **TypeScript Path Mappings**: `tsconfig.json` (lines 21-23) maps the root namespace:
  ```json
  "paths": {
    "@/*": ["./src/*"]
  }
  ```

---

## 2. Logic Chain
1. **Node.js Test Runner Compatibility**: Since `@types/node` is configured for version `^20`, we can rely on Node's native `node:test` and `node:assert` modules which are stable in Node.js v20. No additional heavy test runner like Jest is required.
2. **TypeScript Support**: Using the existing `tsx` dependency (`^4.22.5`) with the `--import tsx` argument allows running TS tests directly via Node.js while automatically resolving path mappings (`@/*`) defined in `tsconfig.json`.
3. **SQLite Isolation**: Since `src/db/index.ts` falls back to `process.env.TURSO_DATABASE_URL` before using `local.db`, we can set `TURSO_DATABASE_URL=file:test.db` to isolate tests. The schema can be pushed using `drizzle-kit push` before running tests.
4. **Server Action & Component Mocking**:
   * Server actions call Next.js `revalidatePath`. These must be mocked during standalone tests by stubbing `next/cache` and `next/navigation` modules.
   * UI components can be tested inside a light-weight DOM emulation environment (like JSDOM/happy-dom) or rendered to a static HTML string using `react-dom/server`'s `renderToString` and asserted using regex or cheerio.
5. **Gmail API Mocking**: The Gmail integration uses `globalThis.fetch`. Intercepting HTTP requests to `gmail.googleapis.com` and `oauth2.googleapis.com` at the global `fetch` level is the cleanest, zero-dependency strategy to mock API responses.

---

## 3. Caveats
* **Node Version**: I assume the host executing the tests is running Node.js v20.0.0 or newer. In older versions (like Node 18), module mocking APIs (`mock.module`) or experimental flag structures may slightly differ.
* **Database Cleanup**: In-memory SQLite (`file::memory:`) can also be used, but since we are pushing schemas via CLI (`drizzle-kit push`), a physical file like `test.db` is easier to bootstrap via terminal scripts.

---

## 4. Conclusion
I propose setting up a zero-dependency, native test runner environment using Node.js's built-in `node:test`. 
* Execute tests via `node --import tsx --test tests/**/*.test.ts`.
* Isolate database calls using a separate SQLite file `test.db` populated via `TURSO_DATABASE_URL=file:test.db drizzle-kit push`.
* Stub external API calls to Google/Gmail by overriding the global `fetch` function.
* Test UI component rendering and Tailwind CSS class conditions by parsing generated markup or rendering inside JSDOM.

Detailed implementation structure and code examples are documented in `/Users/shub/.gemini/antigravity/scratch/shubscribe_v2/.agents/explorer_m1_1/analysis.md`.

---

## 5. Verification Method
Verify the configuration proposal:
1. Inspect `/Users/shub/.gemini/antigravity/scratch/shubscribe_v2/.agents/explorer_m1_1/analysis.md` to review the proposed code structures.
2. Verify typescript resolution using `node --import tsx --test`.
