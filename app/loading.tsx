import { BrandLogo } from '@/components/brand/brand-logo'
import { getPlatformSettings } from '@/lib/platform-settings'

export default async function Loading() {
  const settings = await getPlatformSettings()

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-6">
      <BrandLogo variant="mark" src={settings.logo_url} size={64} className="brand-mark-pulse" />
      <p className="text-center text-sm text-muted-foreground">
        Getting your learning space ready…
      </p>
    </div>
  )
}
