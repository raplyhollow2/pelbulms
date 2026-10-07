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

// Page -> icon / badge / mascot pose. Routes marked "suggested" may differ in your app.
export const rigbuPageIcons = {
  "/": "home",
  "/courses": "explore",
  "/courses?category=\u2026": "courses",
  "/courses/[id]": "course-detail",
  "/courses/[id]/lessons/[lessonId]": "lesson",
  "lesson activities": "activities",
  "/resources": "resources",
  "/schedule": "calendar",
  "/ai": "ai-assistant",
  "/dashboard": "dashboard",
  "/dashboard/reports": "progress",
  "dashboard widget": "streak",
  "/certificates": "certificates",
  "/verify": "verify",
  "/teach/create": "teach",
  "/teach": "my-courses",
  "/teach/insights": "insights",
  "/teach/enrollments": "enrollments",
  "/teach/learners": "learners",
  "/kyc": "kyc",
  "/profile": "profile",
  "/settings": "settings",
  "/notifications": "notifications",
  "/search": "search",
  "/#faq": "help",
  "/community": "reviews",
  "/admin": "admin",
  "/auth/login": "sign-in",
  "(menu action)": "sign-out"
} as const;

export const rigbuMascotPoses = {
  default: "Landing hero, About page",
  hello: "Sign in, welcome, onboarding",
  thinking: "Loading, empty states, search with no results",
  celebrate: "Lesson / course complete, certificate issued, KYC approved",
  oops: "404, errors, failed upload",
  sleepy: "Offline, maintenance, no new notifications",
} as const;
