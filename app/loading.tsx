import { BrandLogo } from '@/components/brand/brand-logo'

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-6">
      <BrandLogo variant="mark" size={64} className="brand-mark-pulse" />
      <p className="text-center text-sm text-muted-foreground">
        Getting your learning space ready…
      </p>
    </div>
  )
}
