'use client'

import { Skeleton } from '@/components/ui/skeleton'

export function CourseDetailSkeleton() {
  return (
    <div className="mx-auto max-w-lg pb-24 md:max-w-2xl md:pb-10">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-3 bg-gradient-to-b from-[#1B2433] to-[#34446A] px-4 py-5">
        <Skeleton className="h-3 w-28 bg-white/15" />
        <Skeleton className="h-7 w-4/5 bg-white/20" />
        <Skeleton className="h-4 w-full bg-white/10" />
        <Skeleton className="h-4 w-2/3 bg-white/10" />
      </div>
      <div className="space-y-4 px-4 py-5">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  )
}
