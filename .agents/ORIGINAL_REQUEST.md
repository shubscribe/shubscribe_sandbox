# Original User Request

## Initial Request — 2026-07-09T04:20:24Z

# Teamwork Project Prompt

> Status: Launched

Implement a persistent Notification History feature and redesign the mobile bottom navigation into a dual-pill "liquid glass" layout.

Working directory: /Users/shub/.gemini/antigravity/scratch/shubscribe_v2
Integrity mode: demo

## Requirements

### R1. Notification History
Add a `notifications` database table, a Bell icon to the sidebar/mobile nav, and a sliding panel to view, mark as read, and clear notifications. Hook up the backend (e.g. Gmail syncing) to populate real notifications.

### R2. Mobile Nav Redesign & User Design
Refactor the `.liquid-bar` CSS and BottomNav component to use an iOS 18 "Dynamic Island" or liquid glass style. The agents are free to figure out the exact layout, provided it results in a premium, dual-pill layout with extreme background blur (`blur(40px)`) and reduced translucency. Ensure the implementation strictly adheres to the user's design aesthetic ("apple liquid glass, smooth animations, dynamic design").

## Acceptance Criteria

### Verification
- [ ] Running `npx drizzle-kit push` successfully updates the database with the `notifications` table without data loss.
- [ ] Generating a test notification saves it to the DB and increments the unread badge on the Bell icon.
- [ ] Opening the mobile viewport renders a distinct, heavily-blurred, premium liquid glass layout for the navigation.
