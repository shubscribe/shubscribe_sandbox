# Scope: Implementation Track

## Mission
Implement the persistent Notification History feature and redesign the mobile bottom navigation into a premium liquid glass layout. Ensure all code passes 100% of the E2E test suite (Tiers 1-4) and undergo Phase 2 adversarial coverage hardening.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Database Schema | Verify schema definitions, push changes to local db | None | DONE |
| M2 | Server Actions | Implement notifications server actions | M1 | IN_PROGRESS |
| M3 | Mobile Nav Redesign | Redesign `.liquid-bar` and `BottomNav.tsx` to a dual-pill liquid glass layout | None | PLANNED |
| M4 | Notifications UI | Add bell icon to Sidebar & BottomNav, implement NotificationsPanel sliding panel | M2, M3 | PLANNED |
| M5 | Backend Integration | Update Gmail sync routines (`gmail.ts`) to write notifications | M2 | PLANNED |
| M6 | Test Verification (Phase 1) | Run and pass 100% of the E2E test suite (Tiers 1-4) published in `TEST_READY.md` | M4, M5, TEST_READY.md | PLANNED |
| M7 | Hardening (Phase 2) | Run Tier 5 adversarial coverage checks, resolve all gaps | M6 | PLANNED |

## Interface Contracts
### Notifications Server Actions (`src/actions/notifications.ts`)
- `getNotifications()` - Retrieves all notifications, ordered by `createdAt` descending.
- `markAsRead(id: string)` - Marks a single notification as read.
- `markAllAsRead()` - Marks all notifications as read.
- `clearNotifications()` - Deletes all notifications.
- `createNotification(title: string, message: string, linkUrl?: string)` - Inserts a new notification and triggers revalidation.

## Visual & Interaction Style (Aesthetic: Apple Liquid Glass)
- **Background Blur**: `backdrop-filter: blur(40px) saturate(2.0)`
- **Translucency**: Reduced opacity, premium Apple-like styling
- **Animations**: Smooth sliding panel transitions, hover scales, and responsive transitions.
