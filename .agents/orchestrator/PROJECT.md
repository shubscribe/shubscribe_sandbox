# Project: Persistent Notifications & Mobile Navigation Redesign

## Architecture
- **Database**: Turso SQLite (using Drizzle ORM). The `notifications` table stores persistent user notifications.
- **Server Actions**: Next.js Server Actions handle CRUD operations for notifications (`getNotifications`, `markAsRead`, `clearNotifications`).
- **UI Components**:
  - `BottomNav.tsx`: Renders the mobile navigation. Redesigned to use a dual-pill liquid glass layout.
  - `Sidebar.tsx`: Renders the desktop sidebar. Includes the notification Bell icon.
  - `NotificationsPanel.tsx`: A sliding panel overlay displaying the notification history, allowing read/clear actions.
- **Backend Integrations**:
  - `gmail.ts`: When Gmail scanning detects new suggestions or auto-added applications, it inserts notifications into the DB.
  - `/api/scan`: Runs periodically to sync Gmail, triggering notification generation.

## Code Layout
- `src/db/schema.ts` — Drizzle SQLite schema, defines the `notifications` table.
- `src/actions/notifications.ts` — Server Actions for CRUD operations on notifications.
- `src/components/shell/BottomNav.tsx` — Mobile bottom navigation component.
- `src/components/shell/Sidebar.tsx` — Desktop sidebar navigation component.
- `src/components/shell/NotificationsPanel.tsx` — Slide-out panel for notification history.
- `src/lib/gmail.ts` — Gmail sync and scan logic.
- `src/app/globals.css` — Global CSS stylesheet with liquid glass design tokens.
- `tests/` — Directory containing E2E and unit verification tests.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | E2E Test Suite | Create opaque-box E2E test cases (Tiers 1-4) & verification scripts; publish `TEST_READY.md` | None | PLANNED |
| M2 | Database Schema | Push/verify the `notifications` table schema without data loss | M1 | PLANNED |
| M3 | Server Actions | Implement notifications CRUD Server Actions | M2 | PLANNED |
| M4 | Bottom Nav Redesign | Refactor `.liquid-bar` and `BottomNav.tsx` for iOS 18 "Dynamic Island" layout (dual-pill, blur(40px)) | M1 | PLANNED |
| M5 | Notifications UI | Create Bell icon, unread badge, and NotificationsPanel sliding drawer UI | M3, M4 | PLANNED |
| M6 | Gmail Sync Integration | Update `scanGmail` and `scanInboxApplications` to write notifications to DB | M3 | PLANNED |
| M7 | Testing & Hardening | Pass E2E tests, resolve lints, and perform Tier 5 adversarial coverage hardening | M5, M6 | PLANNED |

## Interface Contracts
### Notifications Server Actions ↔ UI
- `getNotifications(): Promise<Notification[]>` - Retrieve all notifications, sorted by createdAt DESC.
- `markAsRead(id: string): Promise<void>` - Mark a specific notification as read.
- `markAllAsRead(): Promise<void>` - Mark all notifications as read.
- `clearNotifications(): Promise<void>` - Delete all notifications from the database.
- `createNotification(title: string, message: string, linkUrl?: string): Promise<string>` - Insert a new notification.
