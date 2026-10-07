'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  catalogHasLearnMenus,
  defaultKeysForRole,
  hasCap,
} from '@/lib/capability-catalog'
import type { UserRole } from '@/lib/roles'
import { getBrowserClient } from '@/lib/supabase/client'

type CapabilitiesContextValue = {
  loaded: boolean
  role: UserRole
  keys: Set<string>
  has: (key: string) => boolean
  hasAny: (keys: string[]) => boolean
  refresh: () => Promise<boolean>
}

const CapabilitiesContext = createContext<CapabilitiesContextValue | null>(null)

export function CapabilitiesProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  const [role, setRole] = useState<UserRole>('student')
  const [keys, setKeys] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    try {
      const { data } = await getBrowserClient().auth.getSession()
      if (!data.session) return false
      const res = await fetch('/api/admin/capabilities/me')
      // A rejected session cookie is not an empty menu. Leave the last keys
      // and keep loaded false so the nav can stay on the role defaults.
      if (res.status === 401 || !res.ok) return false
      const json = await res.json()
      const roleValue = (json.role || json.baseArchetype || 'student') as UserRole
      setRole(roleValue)
      const list: string[] = Array.isArray(json.capabilities) ? json.capabilities : []
      const next = new Set(list)
      // A resolved catalog is exact for page checks. The nav still unions role defaults.
      if (json.catalogResolved !== true && !catalogHasLearnMenus(next)) {
        defaultKeysForRole(roleValue).forEach((k) => next.add(k))
      }
      setKeys(next)
      setLoaded(true)
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer = 0
    let attempt = 0

    const run = async () => {
      const ok = await refresh()
      if (cancelled || ok) return
      attempt += 1
      if (attempt >= 5) return
      timer = window.setTimeout(() => {
        void run()
      }, Math.min(8000, 400 * 2 ** attempt))
    }

    void run()

    const { data } = getBrowserClient().auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (!session) return
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Defer so this callback does not call auth methods re-entrantly.
        window.setTimeout(() => {
          if (!cancelled) void refresh()
        }, 0)
      }
    })

    const onChange = () => {
      void refresh()
    }
    window.addEventListener('rigbu:capabilities-changed', onChange)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      data.subscription.unsubscribe()
      window.removeEventListener('rigbu:capabilities-changed', onChange)
    }
  }, [refresh])

  const value = useMemo<CapabilitiesContextValue>(
    () => ({
      loaded,
      role,
      keys,
      has: (key: string) => hasCap(keys, key),
      hasAny: (list: string[]) => list.some((k) => hasCap(keys, k)),
      refresh,
    }),
    [loaded, role, keys, refresh]
  )

  return (
    <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>
  )
}

export function useCapabilities(): CapabilitiesContextValue {
  const ctx = useContext(CapabilitiesContext)
  if (!ctx) {
    return {
      loaded: false,
      role: 'student',
      keys: new Set(),
      has: () => false,
      hasAny: () => false,
      refresh: async () => false,
    }
  }
  return ctx
}
