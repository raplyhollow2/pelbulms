'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LogOut, Search, type LucideIcon } from 'lucide-react'
import { Rigbu } from '@/components/brand/rigbu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Kbd } from '@/components/ui/kbd'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { createClient } from '@/lib/supabase/client'
import { leavePresenceAndSignOut } from '@/components/presence/presence-tracker'
import { resolveMediaUrl } from '@/lib/media'
import { cn, haptic, warning as hapticWarning } from '@/lib/utils'
import { useCapabilities } from '@/components/auth/capabilities-provider'
import { defaultKeysForRole, hasCap } from '@/lib/capability-catalog'
import { buildAccessNav, ROLE_PANELS } from '@/lib/nav-access'
import { coerceUserRole, ROLE_LABELS } from '@/lib/roles'

interface DesktopSidebarProps {
  user?: any
  siteName?: string
  profile?: {
    role?: string | null
    full_name?: string | null
    avatar_url?: string | null
  } | null
}

interface NavItem {
  name: string
  href: string
  icon: LucideIcon
}

export function DesktopSidebar({ user, siteName = 'Rigbu LMS', profile: profileHint = null }: DesktopSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { loaded: capsLoaded, has: hasCapKey, role: capRole } = useCapabilities()
  const [userRole, setUserRole] = useState<
    'student' | 'instructor' | 'admin' | 'resource_person' | 'superadmin'
  >('student')
  const [profile, setProfile] = useState<{ full_name?: string; avatar_url?: string } | null>(null)

  const roleForNav = capsLoaded ? capRole : userRole
  const has = (key: string) =>
    capsLoaded ? hasCapKey(key) : hasCap(defaultKeysForRole(roleForNav), key)
  const panels = buildAccessNav(has)
  const accountLabel = ROLE_LABELS[roleForNav]

  useEffect(() => {
    if (user) fetchProfile()
  }, [user, profileHint])

  const fetchProfile = async () => {
    try {
      let role = coerceUserRole(profileHint?.role || user?.app_metadata?.role)
      if (profileHint) {
        setProfile({
          full_name: profileHint.full_name || undefined,
          avatar_url: profileHint.avatar_url || undefined,
        })
      } else {
        const supabase = createClient()
        const { data } = await supabase
          .from('profiles')
          .select('role, full_name, avatar_url')
          .eq('id', user.id)
          .single()
        role = coerceUserRole((data as any)?.role || user?.app_metadata?.role)
        if (data) {
          setProfile({ full_name: (data as any).full_name, avatar_url: (data as any).avatar_url })
        }
      }
      setUserRole(role)
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const openCommandPalette = () => {
    window.dispatchEvent(new Event('rigbu:open-search'))
  }

  const handleLogout = async () => {
    hapticWarning()
    try {
      await leavePresenceAndSignOut()
      window.location.replace('/')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const initials = displayName.charAt(0).toUpperCase()

  const isItemActive = (item: NavItem) => {
    const itemPath = item.href.split('?')[0]
    const wantsApprovals = item.href.includes('tab=approvals')
    const onUsers = pathname === '/admin/users' || pathname.startsWith('/admin/users/')
    if (wantsApprovals) return onUsers && searchParams.get('tab') === 'approvals'
    if (itemPath === '/admin/users') return onUsers && searchParams.get('tab') !== 'approvals'
    if (itemPath === '/admin') return pathname === '/admin'
    return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={siteName}
              className="[&_svg]:size-8! group-data-[collapsible=icon]:[&_svg]:size-7!"
              render={<Link href="/dashboard" />}
            >
              <Rigbu />
              <span className="truncate text-base font-semibold">{siteName}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={displayName} render={<Link href="/profile" />}>
              <Avatar className="size-8">
                <AvatarImage src={resolveMediaUrl(profile?.avatar_url) || undefined} alt={displayName} />
                <AvatarFallback className="bg-primary text-primary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">{displayName}</span>
                <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {accountLabel}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Search" onClick={openCommandPalette}>
                  <Search />
                  <span>Search</span>
                  <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">⌘K</Kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {ROLE_PANELS.map((panel) => {
          const items = panels[panel.id]
          if (items.length === 0) return null
          return (
            <SidebarGroup key={panel.id}>
              <SidebarGroupLabel>{panel.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active = isItemActive(item)
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={item.name}
                          render={
                            <Link
                              href={item.href}
                              onClick={() => haptic()}
                              aria-current={active ? 'page' : undefined}
                            />
                          }
                        >
                          <item.icon className={cn(active && 'text-primary')} />
                          <span>{item.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Logout" onClick={handleLogout}>
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
