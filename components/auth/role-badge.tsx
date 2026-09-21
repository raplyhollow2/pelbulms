import { cn } from '@/lib/utils'
import { coerceUserRole, ROLE_LABELS, type UserRole } from '@/lib/roles'

type RoleBadgeSize = 'sm' | 'md' | 'lg'

const ROLE_BADGE_CLASS: Record<UserRole, string> = {
  student: 'bg-blue-700 text-white',
  instructor: 'bg-violet-700 text-white',
  admin: 'bg-red-700 text-white',
  resource_person: 'bg-teal-800 text-white',
  superadmin: 'bg-zinc-900 text-white',
}

export function RoleBadge({
  role,
  size = 'md',
  className,
}: {
  role?: string | null
  size?: RoleBadgeSize
  className?: string
}) {
  const key = coerceUserRole(role)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide shadow-sm',
        size === 'sm' && 'h-5 px-2 text-[11px]',
        size === 'md' && 'h-6 px-2.5 text-xs',
        size === 'lg' && 'h-8 px-3.5 text-sm',
        ROLE_BADGE_CLASS[key],
        className
      )}
    >
      {ROLE_LABELS[key]}
    </span>
  )
}
