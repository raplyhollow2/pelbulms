import { AuthSiteProvider } from '@/components/auth/auth-site'
import { resolveMediaUrl } from '@/lib/media'
import { getPlatformSettings } from '@/lib/platform-settings'

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPlatformSettings()

  return (
    <AuthSiteProvider
      siteName={settings.site_name || 'Rigbu'}
      logoUrl={resolveMediaUrl(settings.logo_url)}
    >
      {children}
    </AuthSiteProvider>
  )
}
