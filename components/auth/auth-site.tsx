'use client'

import { createContext, useContext, useMemo } from 'react'

type AuthSite = {
  siteName: string
  logoUrl: string | null
}

const AuthSiteContext = createContext<AuthSite>({
  siteName: 'Rigbu',
  logoUrl: null,
})

export function AuthSiteProvider({
  siteName,
  logoUrl,
  children,
}: AuthSite & { children: React.ReactNode }) {
  const value = useMemo(() => ({ siteName, logoUrl }), [siteName, logoUrl])
  return <AuthSiteContext.Provider value={value}>{children}</AuthSiteContext.Provider>
}

export function useAuthSite() {
  return useContext(AuthSiteContext)
}
