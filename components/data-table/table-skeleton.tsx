import { Skeleton } from '@/components/ui/skeleton'

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-card p-4">
      <Skeleton className="h-9 w-full max-w-sm" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  )
}
