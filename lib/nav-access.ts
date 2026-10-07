import type { RigbuIconName } from '@/components/brand/RigbuIcon'
import { defaultKeysForRole, hasCap, MENU_LINKS, type NavSection } from '@/lib/capability-catalog'

export type AccessNavItem = {
  name: string
  href: string
  icon: RigbuIconName
  section: NavSection
  group?: string
  panel: RolePanel
}

export type RolePanel = 'student' | 'instructor' | 'resource_person' | 'admin' | 'superadmin'

export const ROLE_PANELS: { id: RolePanel; label: string; short: string }[] = [
  { id: 'student', label: 'Student', short: 'Stu' },
  { id: 'instructor', label: 'Instructor', short: 'Ins' },
  { id: 'resource_person', label: 'Resource Person', short: 'RP' },
  { id: 'admin', label: 'Admin', short: 'Adm' },
  { id: 'superadmin', label: 'Superadmin', short: 'SA' },
]

function panelForLink(link: (typeof MENU_LINKS)[number]): RolePanel {
  if (link.panel) return link.panel
  if (link.section === 'learn') return 'student'
  if (link.section === 'teach') return 'instructor'
  return 'admin'
}

/** Role defaults always count, and a granted key can add a link. An empty catalog cannot hide the role menu. */
export function hasMenuAccess(
  role: string | null | undefined,
  extraHas: (key: string) => boolean
): (key: string) => boolean {
  const defaults = defaultKeysForRole(role)
  return (key: string) => hasCap(defaults, key) || extraHas(key)
}

export function buildAccessNav(has: (key: string) => boolean): Record<RolePanel, AccessNavItem[]> {
  const grouped: Record<RolePanel, AccessNavItem[]> = {
    student: [],
    instructor: [],
    resource_person: [],
    admin: [],
    superadmin: [],
  }

  for (const link of MENU_LINKS) {
    if (!has(link.cap)) continue
    const panel = panelForLink(link)
    grouped[panel].push({
      name: link.name,
      href: link.href,
      icon: link.icon,
      section: link.section,
      group: link.group,
      panel,
    })
  }

  return grouped
}

/** Permissions-matrix group for a catalog menu_key. */
export function panelForMenuKey(menuKey: string): RolePanel {
  if (menuKey.startsWith('learn.')) return 'student'
  if (menuKey.startsWith('teach.')) return 'instructor'
  if (menuKey === 'approvals') return 'resource_person'
  if (
    menuKey === 'permissions' ||
    menuKey === 'ai' ||
    menuKey === 'reviewers' ||
    menuKey === 'courses' ||
    menuKey === 'settings' ||
    menuKey.startsWith('settings.')
  ) {
    return 'superadmin'
  }
  return 'admin'
}
