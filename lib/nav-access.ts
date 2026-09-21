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
import { CAP } from '@/lib/capability-keys'
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
}

export function buildAccessNav(
  has: (key: string) => boolean,
  opts?: { showApprovalsShortcut?: boolean }
): { learn: AccessNavItem[]; teach: AccessNavItem[]; admin: AccessNavItem[] } {
  const items = MENU_LINKS.filter((link) => has(link.cap)).map((link) => ({
    name: link.name,
    href: link.href,
    icon: ICONS[link.icon],
    section: link.section,
  }))

  const learn = items.filter((i) => i.section === 'learn')
  const teach = items.filter((i) => i.section === 'teach')
  const admin = items.filter((i) => i.section === 'admin')

  if (opts?.showApprovalsShortcut && has(CAP.APPROVALS_VIEW) && !has(CAP.USERS_VIEW)) {
    teach.push({
      name: 'Users',
      href: '/admin/users?tab=approvals',
      icon: Users,
      section: 'teach',
    })
  }

  return { learn, teach, admin }
}
