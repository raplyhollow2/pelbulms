import type { UserRole } from '@/lib/roles'
import { CAP, type CapabilityKey } from '@/lib/capability-keys'

export type NavSection = 'learn' | 'teach' | 'admin'

export type MenuLink = {
  cap: CapabilityKey
  name: string
  href: string
  section: NavSection
  icon:
    | 'Home'
    | 'BookOpen'
    | 'TrendingUp'
    | 'Activity'
    | 'Bell'
    | 'User'
    | 'Settings'
    | 'GraduationCap'
    | 'HardDrive'
    | 'BarChart3'
    | 'LayoutDashboard'
    | 'Users'
    | 'Building2'
    | 'Shield'
    | 'Sparkles'
  keywords?: string
  /** Optional command-palette subgroup. */
  group?: string
}

/** Sidebar / command-palette rows keyed to capability catalog keys. */
export const MENU_LINKS: MenuLink[] = [
  { cap: CAP.LEARN_DASHBOARD_VIEW, name: 'Dashboard', href: '/dashboard', section: 'learn', icon: 'Home' },
  { cap: CAP.LEARN_COURSES_VIEW, name: 'Courses', href: '/courses', section: 'learn', icon: 'BookOpen' },
  { cap: CAP.LEARN_PROGRESS_VIEW, name: 'Progress', href: '/learn/progress', section: 'learn', icon: 'Activity', keywords: 'my progress learning' },
  { cap: CAP.LEARN_REPORTS_VIEW, name: 'Reports', href: '/learn/reports', section: 'learn', icon: 'TrendingUp' },
  { cap: CAP.LEARN_ANNOUNCEMENTS_VIEW, name: 'Announcements', href: '/announcements', section: 'learn', icon: 'Bell' },
  { cap: CAP.LEARN_PROFILE_VIEW, name: 'Profile', href: '/profile', section: 'learn', icon: 'User' },
  { cap: CAP.LEARN_SETTINGS_VIEW, name: 'Settings', href: '/settings', section: 'learn', icon: 'Settings' },

  { cap: CAP.TEACH_DASHBOARD_VIEW, name: 'Teacher Dashboard', href: '/teach/dashboard', section: 'teach', icon: 'GraduationCap' },
  { cap: CAP.TEACH_MEDIA_VIEW, name: 'Media Library', href: '/teach/media', section: 'teach', icon: 'HardDrive' },
  { cap: CAP.TEACH_REPORTS_VIEW, name: 'Reports', href: '/teach/reports', section: 'teach', icon: 'BarChart3' },
  { cap: CAP.TEACH_ANNOUNCEMENTS_VIEW, name: 'Announcements', href: '/teach/announcements', section: 'teach', icon: 'Bell' },

  { cap: CAP.DASHBOARD_VIEW, name: 'Overview', href: '/admin?overview=1', section: 'admin', icon: 'LayoutDashboard' },
  { cap: CAP.USERS_VIEW, name: 'Users', href: '/admin/users', section: 'admin', icon: 'Users' },
  { cap: CAP.REPORTS_VIEW, name: 'Reports', href: '/admin/reports', section: 'admin', icon: 'BarChart3' },
  { cap: CAP.INSTITUTIONS_VIEW, name: 'Institutions', href: '/admin/settings/institutions', section: 'admin', icon: 'Building2' },
  { cap: CAP.SETTINGS_VIEW, name: 'Site admin', href: '/admin/settings', section: 'admin', icon: 'Settings' },
  { cap: CAP.PERMISSIONS_VIEW, name: 'Permissions', href: '/admin/permissions', section: 'admin', icon: 'Shield' },
  { cap: CAP.AI_VIEW, name: 'AI', href: '/admin/ai', section: 'admin', icon: 'Sparkles' },
]

export const LEARN_MENU_CAPS: CapabilityKey[] = MENU_LINKS.filter((l) => l.section === 'learn').map(
  (l) => l.cap
)
export const TEACH_MENU_CAPS: CapabilityKey[] = MENU_LINKS.filter((l) => l.section === 'teach').map(
  (l) => l.cap
)

export const LEARNER_MODULE_VIEW_CAPS: CapabilityKey[] = [
  CAP.MODULE_CERTIFICATES_VIEW,
  CAP.MODULE_FORUMS_VIEW,
  CAP.MODULE_QUIZZES_VIEW,
  CAP.MODULE_FLASHCARDS_VIEW,
  CAP.MODULE_SCORM_VIEW,
  CAP.MODULE_ANNOUNCEMENTS_VIEW,
]

export const TEACHER_MODULE_CAPS: CapabilityKey[] = [
  ...LEARNER_MODULE_VIEW_CAPS,
  CAP.MODULE_CERTIFICATES_CONFIGURE,
  CAP.MODULE_FORUMS_CONFIGURE,
  CAP.MODULE_QUIZZES_CONFIGURE,
  CAP.MODULE_FLASHCARDS_CONFIGURE,
  CAP.MODULE_SCORM_CONFIGURE,
  CAP.MODULE_INTERVENTIONS_VIEW,
  CAP.MODULE_INTERVENTIONS_CONFIGURE,
  CAP.MODULE_ANNOUNCEMENTS_CONFIGURE,
]

export const ADMIN_MENU_CAPS: CapabilityKey[] = [
  CAP.DASHBOARD_VIEW,
  CAP.USERS_VIEW,
  CAP.USERS_ADD,
  CAP.USERS_EDIT,
  CAP.USERS_DELETE,
  CAP.APPROVALS_VIEW,
  CAP.APPROVALS_EDIT,
  CAP.REPORTS_VIEW,
  CAP.INSTITUTIONS_VIEW,
  CAP.INSTITUTIONS_ADD,
  CAP.INSTITUTIONS_EDIT,
  CAP.INSTITUTIONS_DELETE,
  CAP.SETTINGS_VIEW,
  CAP.SETTINGS_EDIT,
]

/** Activity picker / course-editor → module configure key. */
export const ACTIVITY_MODULE_CAP: Partial<Record<string, CapabilityKey>> = {
  quiz: CAP.MODULE_QUIZZES_CONFIGURE,
  forum: CAP.MODULE_FORUMS_CONFIGURE,
  scorm: CAP.MODULE_SCORM_CONFIGURE,
  ims: CAP.MODULE_SCORM_CONFIGURE,
  flashcard: CAP.MODULE_FLASHCARDS_CONFIGURE,
}

export function defaultKeysForRole(role: UserRole | string | null | undefined): Set<string> {
  const keys = new Set<string>()
  const add = (list: CapabilityKey[]) => list.forEach((k) => keys.add(k))

  if (role === 'superadmin') {
    keys.add('*')
    return keys
  }

  add(LEARN_MENU_CAPS)

  if (role === 'student') {
    add(LEARNER_MODULE_VIEW_CAPS)
    return keys
  }

  if (role === 'resource_person') {
    add(LEARNER_MODULE_VIEW_CAPS)
    keys.add(CAP.APPROVALS_VIEW)
    keys.add(CAP.APPROVALS_EDIT)
    keys.add(CAP.MODULE_REGISTRATION_KYC_VIEW)
    return keys
  }

  add(TEACH_MENU_CAPS)
  add(TEACHER_MODULE_CAPS)

  if (role === 'admin') {
    add(ADMIN_MENU_CAPS)
  }

  return keys
}

export function hasCap(keys: Iterable<string> | Set<string>, key: string): boolean {
  const set = keys instanceof Set ? keys : new Set(keys)
  return set.has('*') || set.has(key)
}

export function catalogHasLearnMenus(keys: Iterable<string>): boolean {
  const set = keys instanceof Set ? keys : new Set(keys)
  if (set.has('*')) return true
  return LEARN_MENU_CAPS.some((k) => set.has(k))
}

export function catalogHasTeachMenus(keys: Iterable<string>): boolean {
  const set = keys instanceof Set ? keys : new Set(keys)
  if (set.has('*')) return true
  return TEACH_MENU_CAPS.some((k) => set.has(k))
}
