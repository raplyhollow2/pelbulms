'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, ClipboardList, Globe, Megaphone, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCapabilities } from '@/components/auth/capabilities-provider'
import { CAP } from '@/lib/capability-keys'

const ITEMS = [
  { href: '/admin/settings', label: 'Site', icon: Globe, exact: true, cap: CAP.SETTINGS_VIEW },
  { href: '/admin/settings/registration', label: 'Registration', icon: ClipboardList, cap: CAP.SETTINGS_VIEW },
  { href: '/admin/settings/institutions', label: 'Institutions', icon: Building2, cap: CAP.INSTITUTIONS_VIEW },
  { href: '/admin/settings/marketing', label: 'Marketing', icon: Megaphone, cap: CAP.SETTINGS_VIEW },
  { href: '/admin/permissions', label: 'Permissions', icon: Shield, cap: CAP.PERMISSIONS_VIEW },
]

export function AdminSettingsNav() {
  const pathname = usePathname()
  const { has } = useCapabilities()

  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 sm:flex-wrap">
      {ITEMS.filter((item) => has(item.cap)).map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
