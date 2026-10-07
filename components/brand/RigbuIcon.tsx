// Rigbu page & navigation icons — generated from the Rigbu Brand Kit v2.
// Outline by default; pass `active` for the duotone (selected) state.
// Colour follows `currentColor`; the active fill uses --rigbu-accent (default gold #F5B82E).
import * as React from "react";

export const RIGBU_ICON_NAMES = ["home", "explore", "courses", "course-detail", "lesson", "activities", "resources", "calendar", "ai-assistant", "dashboard", "progress", "streak", "certificates", "verify", "teach", "my-courses", "insights", "enrollments", "learners", "kyc", "profile", "settings", "notifications", "search", "help", "reviews", "admin", "sign-in", "sign-out"] as const;
export type RigbuIconName = (typeof RIGBU_ICON_NAMES)[number];

type IconDef = { fill: React.ReactNode; line: React.ReactNode; solid: React.ReactNode | null };

const ICONS: Record<RigbuIconName, IconDef> = {
  "home": {
    fill: <><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" /></>,
    line: <><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19Z" /><path d="M10 20.5V15.5h4v5" /></>,
    solid: null,
  },
  "explore": {
    fill: <><circle cx="12" cy="12" r="9" /></>,
    line: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5 13.6 13.6 8.5 15.5 10.4 10.4Z" /></>,
    solid: null,
  },
  "courses": {
    fill: <><path d="M12 6.5C10.5 5 8 4.5 4 4.5V18c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2V4.5c-4 0-6.5.5-8 2Z" /></>,
    line: <><path d="M12 6.5C10.5 5 8 4.5 4 4.5V18c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2V4.5c-4 0-6.5.5-8 2Z" /><path d="M12 6.5V20" /></>,
    solid: null,
  },
  "course-detail": {
    fill: <><path d="M5 18.5V5.5A2.5 2.5 0 0 1 7.5 3H19v18H7.5A2.5 2.5 0 0 1 5 18.5Z" /></>,
    line: <><path d="M5 18.5V5.5A2.5 2.5 0 0 1 7.5 3H19v18H7.5A2.5 2.5 0 0 1 5 18.5Z" /><path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19" /><path d="M10 3v6l2-1.5L14 9V3" /></>,
    solid: null,
  },
  "lesson": {
    fill: <><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z" /></>,
    line: <><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z" /></>,
    solid: <><path d="M10 9.2v5.6l4.6-2.8Z" /></>,
  },
  "activities": {
    fill: <><rect x="5" y="3" width="14" height="18" rx="2.5" /></>,
    line: <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M8.5 8.5l1.3 1.3 2.4-2.4M14.5 8.5h1.5M8.5 14.5l1.3 1.3 2.4-2.4M14.5 14.5h1.5" /></>,
    solid: null,
  },
  "resources": {
    fill: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2 2.5h7.4A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z" /></>,
    line: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.6l2 2.5h7.4A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z" /><path d="M12 10.5v6M9.5 14 12 16.5 14.5 14" /></>,
    solid: null,
  },
  "calendar": {
    fill: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /></>,
    line: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
    solid: <><circle cx="9" cy="14.8" r="1.1" /><circle cx="13" cy="14.8" r="1.1" /></>,
  },
  "ai-assistant": {
    fill: <><path d="M11 3.5c.6 3.8 2.2 5.4 6 6-3.8.6-5.4 2.2-6 6-.6-3.8-2.2-5.4-6-6 3.8-.6 5.4-2.2 6-6Z" /></>,
    line: <><path d="M11 3.5c.6 3.8 2.2 5.4 6 6-3.8.6-5.4 2.2-6 6-.6-3.8-2.2-5.4-6-6 3.8-.6 5.4-2.2 6-6Z" /><path d="M18 14.5c.3 1.6.9 2.2 2.5 2.5-1.6.3-2.2.9-2.5 2.5-.3-1.6-.9-2.2-2.5-2.5 1.6-.3 2.2-.9 2.5-2.5Z" /></>,
    solid: <><circle cx="5.5" cy="18.5" r="1.1" /></>,
  },
  "dashboard": {
    fill: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>,
    line: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" /></>,
    solid: null,
  },
  "progress": {
    fill: <><path d="M8 15L11.5 11L14.5 13.5L19.5 8V20H8Z" /></>,
    line: <><path d="M4 4v14.5A1.5 1.5 0 0 0 5.5 20H20" /><path d="M8 15l3.5-4 3 2.5L19.5 8" /><path d="M15.5 8h4v4" /></>,
    solid: null,
  },
  "streak": {
    fill: <><path d="M12 21c-3.6 0-6.5-2.7-6.5-6.3 0-3.5 2.3-5.3 3.4-8.2.9 1.2 1.5 2.4 1.7 3.6 1.4-2 2.4-4.6 1.9-7.1 3.6 2.2 6 6.4 6 11.4 0 3.8-2.7 6.6-6.5 6.6Z" /></>,
    line: <><path d="M12 21c-3.6 0-6.5-2.7-6.5-6.3 0-3.5 2.3-5.3 3.4-8.2.9 1.2 1.5 2.4 1.7 3.6 1.4-2 2.4-4.6 1.9-7.1 3.6 2.2 6 6.4 6 11.4 0 3.8-2.7 6.6-6.5 6.6Z" /><path d="M12 21c-1.6 0-2.8-1.2-2.8-2.8 0-1.7 1.4-2.6 2-4.2 1.4 1 2.6 2.4 2.6 4.3 0 1.5-.8 2.7-1.8 2.7Z" /></>,
    solid: null,
  },
  "certificates": {
    fill: <><circle cx="12" cy="9" r="6" /></>,
    line: <><circle cx="12" cy="9" r="6" /><path d="M8.6 13.9 7.5 21l4.5-2.6 4.5 2.6-1.1-7.1" /></>,
    solid: <><path d="M12.00 6.50L12.68 8.27L14.57 8.37L13.09 9.56L13.59 11.38L12.00 10.35L10.41 11.38L10.91 9.56L9.43 8.37L11.32 8.27Z" /></>,
  },
  "verify": {
    fill: <><path d="M12 3l7 3v5.5c0 4.6-3 8.1-7 9.5-4-1.4-7-4.9-7-9.5V6Z" /></>,
    line: <><path d="M12 3l7 3v5.5c0 4.6-3 8.1-7 9.5-4-1.4-7-4.9-7-9.5V6Z" /><path d="M9 12l2.2 2.2L15.5 10" /></>,
    solid: null,
  },
  "teach": {
    fill: <><rect x="3" y="4" width="18" height="12" rx="2.5" /></>,
    line: <><rect x="3" y="4" width="18" height="12" rx="2.5" /><path d="M12 16v4M8.5 20h7" /><path d="M12 7.5v5M9.5 10h5" /></>,
    solid: null,
  },
  "my-courses": {
    fill: <><path d="M12 3.5 20.5 8 12 12.5 3.5 8Z" /></>,
    line: <><path d="M12 3.5 20.5 8 12 12.5 3.5 8Z" /><path d="M3.5 12 12 16.5 20.5 12" /><path d="M3.5 16 12 20.5 20.5 16" /></>,
    solid: null,
  },
  "insights": {
    fill: <><rect x="4.5" y="12" width="3.5" height="8" rx="1.2" /><rect x="10.25" y="7" width="3.5" height="13" rx="1.2" /><rect x="16" y="4" width="3.5" height="16" rx="1.2" /></>,
    line: <><rect x="4.5" y="12" width="3.5" height="8" rx="1.2" /><rect x="10.25" y="7" width="3.5" height="13" rx="1.2" /><rect x="16" y="4" width="3.5" height="16" rx="1.2" /></>,
    solid: null,
  },
  "enrollments": {
    fill: <><path d="M6.5 5h11A1.5 1.5 0 0 1 19 6.5v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-13A1.5 1.5 0 0 1 6.5 5Z" /></>,
    line: <><path d="M8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H16" /><rect x="8.5" y="3" width="7" height="4" rx="1.2" /><path d="M9 13.5l2 2 4-4" /></>,
    solid: null,
  },
  "learners": {
    fill: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6Z" /></>,
    line: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M17.5 14.3c2.1.7 3.5 2.9 3.5 5.7" /></>,
    solid: null,
  },
  "kyc": {
    fill: <><rect x="3" y="5" width="18" height="14" rx="2.5" /></>,
    line: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="8.5" cy="10.5" r="2" /><path d="M5.8 16c.6-1.5 1.6-2.2 2.7-2.2s2.1.7 2.7 2.2" /><path d="M14 10h4M14 13.5h3" /></>,
    solid: null,
  },
  "profile": {
    fill: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6Z" /></>,
    line: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6" /></>,
    solid: null,
  },
  "settings": {
    fill: <><circle cx="15" cy="7" r="2.5" /><circle cx="9" cy="17" r="2.5" /></>,
    line: <><path d="M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20" /><circle cx="15" cy="7" r="2.5" /><circle cx="9" cy="17" r="2.5" /></>,
    solid: null,
  },
  "notifications": {
    fill: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" /></>,
    line: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" /><path d="M10 21.5h4" /></>,
    solid: null,
  },
  "search": {
    fill: <><circle cx="11" cy="11" r="6.5" /></>,
    line: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
    solid: null,
  },
  "help": {
    fill: <><circle cx="12" cy="12" r="9" /></>,
    line: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.4a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1.1.9-1.1 1.8v.4" /></>,
    solid: <><circle cx="12" cy="17" r="1.1" /></>,
  },
  "reviews": {
    fill: <><path d="M5.5 4h13A2.5 2.5 0 0 1 21 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V17h-1A2.5 2.5 0 0 1 3 14.5v-8A2.5 2.5 0 0 1 5.5 4Z" /></>,
    line: <><path d="M5.5 4h13A2.5 2.5 0 0 1 21 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V17h-1A2.5 2.5 0 0 1 3 14.5v-8A2.5 2.5 0 0 1 5.5 4Z" /></>,
    solid: <><path d="M12.00 7.60L12.76 9.65L14.95 9.74L13.24 11.10L13.82 13.21L12.00 12.00L10.18 13.21L10.76 11.10L9.05 9.74L11.24 9.65Z" /></>,
  },
  "admin": {
    fill: <><path d="M4 16a8 8 0 0 1 16 0Z" /></>,
    line: <><path d="M4 16a8 8 0 0 1 16 0" /><path d="M12 16l3.5-4" /><path d="M3.5 19.5h17" /></>,
    solid: <><circle cx="12" cy="16" r="1.5" /></>,
  },
  "sign-in": {
    fill: <><path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14Z" /></>,
    line: <><path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14" /><path d="M4 12h10" /><path d="M10.5 8.5 14 12l-3.5 3.5" /></>,
    solid: null,
  },
  "sign-out": {
    fill: <><path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10Z" /></>,
    line: <><path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10" /><path d="M10 12h10" /><path d="M16.5 8.5 20 12l-3.5 3.5" /></>,
    solid: null,
  },
};

export type RigbuIconProps = Omit<React.SVGProps<SVGSVGElement>, "name"> & {
  name: RigbuIconName;
  size?: number;
  active?: boolean;
  accent?: string;
  strokeWidth?: number;
  title?: string;
};

export function RigbuIcon({
  name,
  size = 24,
  active = false,
  accent = "var(--rigbu-accent, #F5B82E)",
  strokeWidth = 1.75,
  title,
  ...rest
}: RigbuIconProps) {
  const icon = ICONS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <g style={{ fill: accent, opacity: active ? 1 : 0, transition: "opacity 160ms ease" }} stroke="none">
        {icon.fill}
      </g>
      <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        {icon.line}
      </g>
      {icon.solid ? (
        <g fill="currentColor" stroke="currentColor" strokeWidth={0.6} strokeLinejoin="round">
          {icon.solid}
        </g>
      ) : null}
    </svg>
  );
}
