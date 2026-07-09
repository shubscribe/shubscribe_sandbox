# Scope: E2E Testing Track

## Mission
Design, implement, and run a comprehensive, opaque-box E2E test suite (Tiers 1-4) for the Notifications and Bottom Nav Redesign features. Publish `TEST_READY.md` upon completion.

## Architecture & Test Philosophy
- **Opaque-box & Requirement-driven**: Tests must evaluate functionality based on requirements, not internal module structures.
- **Verification Commands**: E2E test suite should be executable via a single command (e.g. `npx tsx tests/run.ts` or `npm test`).
- **No external network dependencies**: Mock any external APIs (like Gmail/Google API endpoints) or use local sandbox data.

## Features to Cover
1. **F1: Database Schema**: `notifications` table existence and Drizzle push safety.
2. **F2: CRUD Server Actions**: Inserting, reading, marking read, and deleting notifications.
3. **F3: Mobile Bottom Nav Rendering**: Distinct visual layout, custom Tailwind classes, 40px background blur.
4. **F4: Mobile Nav Navigation**: Dynamic pill interaction, page routing, active state highlighting.
5. **F5: Notification Bell Icon**: Badge displaying correct unread notification count.
6. **F6: Notifications Sliding Panel**: Slide-out tray displaying notifications, mark as read, clear all.
7. **F7: Gmail Sync Integration**: `scanGmail` and `scanInboxApplications` successfully populate notifications table upon discovery of suggestions/applications.
8. **F8: Test Notification Generation**: Action to trigger a test notification to verify live badge updates.

## Coverage Checklist & Minimums
- **Tier 1 (Feature Coverage)**: ≥5 test cases per feature (Total ≥ 40).
- **Tier 2 (Boundary & Corner Cases)**: ≥5 test cases per feature (Total ≥ 40).
- **Tier 3 (Cross-Feature Combinations)**: ≥8 pairwise test cases (Total ≥ 8).
- **Tier 4 (Real-World Application Scenarios)**: ≥5 integrated user flows (Total ≥ 5).
- **Total Minimum**: 93 test cases.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Test Infrastructure | Setup test runner, mocks, and environment variables | None | PLANNED |
| M2 | Tier 1 & 2 Tests | Implement feature coverage and boundary tests | M1 | PLANNED |
| M3 | Tier 3 & 4 Tests | Implement pairwise and application scenario tests | M2 | PLANNED |
| M4 | Publish Readiness | Finalize test runner and generate `TEST_READY.md` | M3 | PLANNED |
