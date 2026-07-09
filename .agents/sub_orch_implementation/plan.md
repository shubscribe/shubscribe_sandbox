# Detailed Implementation Plan

This plan maps out the step-by-step execution of the Implementation Track milestones.

## Milestone 1: Database Schema (M1)
1. **Explore**:
   - Verify the Drizzle SQLite schema layout in `src/db/schema.ts`.
   - Formulate the Drizzle SQLite `notifications` table schema according to specs:
     - `id`: text/string primary key (generate UUID/cuid)
     - `title`: text (non-nullable)
     - `message`: text (non-nullable)
     - `linkUrl`: text (optional)
     - `isRead`: integer/boolean (non-nullable, default false)
     - `createdAt`: text/timestamp (non-nullable, default now)
   - Outline local database migration/push commands (`npx drizzle-kit push` or similar).
2. **Work**:
   - Implement database schema changes in `src/db/schema.ts`.
   - Run Drizzle kit push command to apply changes locally.
3. **Review**:
   - Verify Drizzle schema compiles and compiles without typescript errors.
   - Verify database migrations ran successfully.
4. **Challenge & Audit**:
   - Challenger validates database operations (basic CRUD on notifications table).
   - Forensic Auditor verifies table structure matches specifications and that no hacking or hardcoding is present.

## Milestone 2: Server Actions (M2)
1. **Explore**:
   - Plan implementation of functions in `src/actions/notifications.ts`:
     - `getNotifications()`
     - `markAsRead(id: string)`
     - `markAllAsRead()`
     - `clearNotifications()`
     - `createNotification(title: string, message: string, linkUrl?: string)`
   - Ensure imports from `src/db` and Drizzle schema are correct.
2. **Work**:
   - Create and implement `src/actions/notifications.ts`.
3. **Review**:
   - Review functions for correctness, TypeScript compilation, and error handling.
4. **Challenge & Audit**:
   - Verify actions work correctly in isolation and integrate with the database.

## Milestone 3: Mobile Bottom Nav Redesign (M3)
1. **Explore**:
   - Locate mobile navigation components (`src/components/shell/BottomNav.tsx`, CSS classes in `src/app/globals.css`).
   - Plan premium liquid glass visual improvements:
     - Backdrop filter: `backdrop-filter: blur(40px) saturate(2.0)`
     - Translucency: customized colors/opacities.
     - Dual-pill / iOS 18 Dynamic Island aesthetic.
2. **Work**:
   - Refactor CSS rules and component structure to apply the liquid glass layout.
3. **Review & Challenge**:
   - Verify responsive behavior on simulated mobile viewport, no layout/typescript compiler warnings.

## Milestone 4: Notifications UI (M4)
1. **Explore**:
   - Analyze where the Bell icon should go (desktop Sidebar, mobile BottomNav).
   - Design NotificationsPanel slide-out drawer (or overlay) displaying notification history, marked/cleared states.
2. **Work**:
   - Build/integrate Bell icon (with unread badge) and the sliding drawer UI using the Server Actions.
3. **Review & Challenge**:
   - Verify visual interactions, accessibility (focus, close), and update status on client state changes (revalidation/mutation).

## Milestone 5: Backend Integration (M5)
1. **Explore**:
   - Analyze `src/lib/gmail.ts` and sync triggers (e.g. `/api/scan`).
   - Find places where email scanning identifies a suggestion or an application is auto-added, and map to `createNotification` calls.
2. **Work**:
   - Integrate `createNotification` calls into `gmail.ts` logic.
3. **Review & Challenge**:
   - Verify that scanning triggers notification insertions.

## Milestone 6: Test Verification (M6 / Phase 1)
1. **Prepare**:
   - Poll for `/Users/shub/.gemini/antigravity/scratch/shubscribe_v2/TEST_READY.md`.
2. **Execute**:
   - Once ready, run the E2E test commands from `TEST_READY.md`.
   - Decompose failures, fix code issues using Explorer -> Worker -> Reviewer -> Challenger loop.
   - All tests must pass.

## Milestone 7: Hardening (M7 / Phase 2)
1. **Challenger-led Analysis**:
   - Challenge code coverage on the new notifications implementation.
   - Run adversarial coverage tests, identify gaps, write regression tests.
   - Work, review, and audit until zero coverage gaps remain.
