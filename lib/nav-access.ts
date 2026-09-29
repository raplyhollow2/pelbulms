import type { LucideIcon } from 'lucide-react'
import {
  Home,
  BookOpen,
  TrendingUp,
  Activity,
  Bell,
  User,
  Settings,
  GraduationCap,
  HardDrive,
  BarChart3,
  LayoutDashboard,
  Users,
  Building2,
  Shield,
  Sparkles,
} from 'lucide-react'
import { MENU_LINKS, type NavSection } from '@/lib/capability-catalog'

const ICONS: Record<(typeof MENU_LINKS)[number]['icon'], LucideIcon> = {
  Home,
  BookOpen,
  TrendingUp,
  Activity,
  Bell,
  User,
  Settings,
  GraduationCap,
  HardDrive,
  BarChart3,
  LayoutDashboard,
  Users,
  Building2,
  Shield,
  Sparkles,
}

export type AccessNavItem = {
  name: string
  href: string
  icon: LucideIcon
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
      icon: ICONS[link.icon],
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
    menuKey === 'courses'
  ) {
    return 'superadmin'
  }
  return 'admin'
}
