'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function CourseCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      {/* Thumbnail Skeleton */}
      <div className="h-40 bg-muted/50">
        <Skeleton className="w-full h-full" />
      </div>

      <CardContent className="p-4">
        {/* Badges Skeleton */}
        <div className="flex gap-2 mb-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>

        {/* Title Skeleton */}
        <Skeleton className="h-5 w-full mb-2" />
        <Skeleton className="h-5 w-3/4 mb-3" />

        {/* Stats Skeleton */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>

        {/* CTA Skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-9 w-32" />
        </div>
      </CardContent>
    </Card>
  )
}

export function CourseGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CourseCardSkeleton key={i} />
      ))}
    </div>
  )
}