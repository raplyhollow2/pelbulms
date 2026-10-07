import { cn } from '@/lib/utils'
import type { RigbuIconName } from '@/components/brand/RigbuIcon'

export function PageBadge({
  name,
  className,
}: {
  name: RigbuIconName
  className?: string
}) {
  return (
    <img
      src={`/icons/badges/png/${name}-128.png`}
      alt=""
      width={48}
      height={48}
      className={cn('size-12 shrink-0', className)}
    />
  )
}
