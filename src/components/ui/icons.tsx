import type { SVGProps } from "react";

/* Clean, consistent line icons (stroke = currentColor). ~20px default.
   One visual language across sidebar, bottom bar and command palette. */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconDashboard(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" />
      <rect x="13.5" y="12" width="7.5" height="9" rx="1.5" />
      <rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5" />
    </Base>
  );
}

export function IconApplications(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="9.5" y="4" width="5" height="16" rx="1.5" />
      <rect x="16" y="4" width="5" height="16" rx="1.5" />
    </Base>
  );
}

export function IconDiscover(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
    </Base>
  );
}

export function IconOutreach(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </Base>
  );
}

export function IconTasks(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 6.5l2 2 3.5-3.5" />
      <path d="M4 15.5l2 2 3.5-3.5" />
      <path d="M13 7h7" />
      <path d="M13 16h7" />
    </Base>
  );
}

export function IconContacts(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 6" />
      <path d="M17.5 19a5.5 5.5 0 0 0-3-4.9" />
    </Base>
  );
}

export function IconAnalytics(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <rect x="7" y="12" width="3" height="5" rx="0.6" />
      <rect x="12" y="8" width="3" height="9" rx="0.6" />
      <rect x="17" y="5" width="3" height="12" rx="0.6" />
    </Base>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M22 12h-3M5 12H2M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7L5.6 5.6" />
    </Base>
  );
}

export function IconMore(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconSun(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </Base>
  );
}

export function IconMoon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" />
    </Base>
  );
}

export function IconSignOut(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="M16 8l4 4-4 4" />
      <path d="M20 12H9" />
    </Base>
  );
}

export function IconHelp(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 4.5 1.5c0 1.7-2 2-2 3.5" />
      <path d="M12 17.5h.01" />
    </Base>
  );
}

export function IconBell(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Base>
  );
}

/** name → component, for data-driven nav lists */
export const NAV_ICONS = {
  dashboard: IconDashboard,
  applications: IconApplications,
  discover: IconDiscover,
  outreach: IconOutreach,
  tasks: IconTasks,
  contacts: IconContacts,
  analytics: IconAnalytics,
  settings: IconSettings,
  notifications: IconBell,
} as const;

export type NavIconName = keyof typeof NAV_ICONS;
