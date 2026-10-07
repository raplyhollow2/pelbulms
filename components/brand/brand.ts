// Rigbu brand tokens — Brand Kit v2
export const rigbuColors = {
  gold: "#F5B82E",   // light of wisdom: accents, active icons, app-icon background
  ember: "#E8743B", // left wing, highlights, warnings
  pine: "#2F6B4F",   // right wing on light backgrounds, success
  mint: "#6FC79A",   // right wing on dark backgrounds
  ink: "#1B2433",     // text, owl body, dark surfaces
  night: "#34446A", // owl body on dark surfaces
  paper: "#FAF7F2", // light surfaces
  sand: "#EFEAE1",   // page background
} as const;

export const rigbuFonts = {
  ui: "'Plus Jakarta Sans', system-ui, sans-serif",
} as const;

// Page -> icon. Keys are real app routes, plus a few non-route actions.
export const rigbuPageIcons = {
  "/": "home",
  "/dashboard": "home",
  "/courses": "explore",
  "/courses/[id]": "course-detail",
  "/learn/[courseId]": "course-detail",
  "/learn/[courseId]/lesson/[lessonId]": "lesson",
  "/learn/progress": "progress",
  "/learn/reports": "progress",
  "/profile": "profile",
  "/profile#certificates": "certificates",
  "/certificates/[courseId]": "certificates",
  "/verify/[code]": "verify",
  "/teach/dashboard": "my-courses",
  "/teach/create": "teach",
  "/teach/courses/new": "teach",
  "/teach/analytics": "insights",
  "/teach/reports": "insights",
  "/teach/media": "resources",
  "/teach/announcements": "notifications",
  "/teach/courses/[courseId]/students": "enrollments",
  "/auth/register": "kyc",
  "/auth/pending-approval": "kyc",
  "/auth/login": "sign-in",
  "/settings": "settings",
  "/announcements": "notifications",
  "/admin": "admin",
  "/admin/users": "learners",
  "/admin/reports": "insights",
  "/admin/ai": "ai-assistant",
  "/admin/permissions": "admin",
  "/admin/settings": "settings",
  "lesson activities": "activities",
  "dashboard widget": "streak",
  search: "search",
  "(menu action)": "sign-out",
} as const;

export const rigbuMascotPoses = {
  default: "Landing hero, About page",
  hello: "Sign in, welcome, onboarding",
  thinking: "Loading, empty states, search with no results",
  celebrate: "Lesson / course complete, certificate issued, KYC approved",
  oops: "404, errors, failed upload",
  sleepy: "Offline, maintenance, no new notifications",
} as const;
