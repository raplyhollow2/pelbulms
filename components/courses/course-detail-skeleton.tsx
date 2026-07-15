'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CourseGridSkeleton } from './course-card-skeleton'

export function CourseDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Back Button Skeleton */}
        <Skeleton className="h-10 w-32" />

        {/* Header Skeleton */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        </div>

        {/* Instructor Skeleton */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Your Instructor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Learning Objectives Skeleton */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">What You'll Learn</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-2">
                  <Skeleton className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Course Modules Skeleton */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-lg">Course Content</CardTitle>
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-lg border border-border/50">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Button Skeleton */}
        <div className="flex justify-center">
          <Skeleton className="h-12 w-48" />
        </div>
      </div>
    </div>
  )
}