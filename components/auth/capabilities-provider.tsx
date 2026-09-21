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

type CapabilitiesContextValue = {
  loaded: boolean
  role: UserRole
  keys: Set<string>
  has: (key: string) => boolean
  hasAny: (keys: string[]) => boolean
  refresh: () => Promise<void>
}

const CapabilitiesContext = createContext<CapabilitiesContextValue | null>(null)

export function CapabilitiesProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  const [role, setRole] = useState<UserRole>('student')
  const [keys, setKeys] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/capabilities/me')
      if (res.status === 401) {
        setKeys(new Set())
        setLoaded(true)
        return
      }
      if (!res.ok) throw new Error('capabilities failed')
      const json = await res.json()
      const roleValue = (json.role || json.baseArchetype || 'student') as UserRole
      setRole(roleValue)
      const list: string[] = Array.isArray(json.capabilities) ? json.capabilities : []
      const next = new Set(list)
      if (!catalogHasLearnMenus(next)) {
        defaultKeysForRole(roleValue).forEach((k) => next.add(k))
      }
      setKeys(next)
    } catch {
      // keep previous keys
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onChange = () => {
      void refresh()
    }
    window.addEventListener('pelbu:capabilities-changed', onChange)
    return () => window.removeEventListener('pelbu:capabilities-changed', onChange)
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
      refresh: async () => {},
    }
  }
  return ctx
}
