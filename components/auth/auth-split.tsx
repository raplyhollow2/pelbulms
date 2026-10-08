'use client'

import { BrandCharacter } from '@/components/brand/brand-character'
import { BrandLogo } from '@/components/brand/brand-logo'
import { useAuthSite } from '@/components/auth/auth-site'

export function AuthSplit({ children }: { children: React.ReactNode }) {
  const { logoUrl } = useAuthSite()

  return (
    <div className="flex h-[calc(100dvh-var(--install-bar-offset,0px))] min-h-0 flex-col overflow-hidden bg-background md:flex-row">
      <aside className="hidden shrink-0 items-center bg-muted md:flex md:w-[42%] md:flex-col md:justify-center md:gap-6 md:px-10">
        <BrandCharacter
          pose="hello"
          alt=""
          className="h-64 w-auto max-h-none max-w-none lg:h-80"
        />
        <BrandLogo href="/" src={logoUrl} height={36} />
      </aside>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-col px-4 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] md:my-auto md:py-6">
          <div className="mb-6 flex flex-col items-center gap-3 md:hidden">
            <BrandCharacter
              pose="hello"
              alt=""
              className="h-16 w-auto max-h-none max-w-none"
            />
            <BrandLogo
              href="/"
              src={logoUrl}
              variant={logoUrl ? 'horizontal' : 'wordmark'}
              height={logoUrl ? 36 : 28}
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
