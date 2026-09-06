'use client'

import { ChevronLeft, ChevronRight, FileText, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TrackedVideoPlayer, type VideoProgressData } from '@/components/learning/tracked-video-player'
import { LessonBlocks } from '@/components/course/lesson-blocks'
import { LessonResources, type ActivityProgressItem } from '@/components/course/lesson-resources'
import { inferLectureKind } from '@/lib/lesson-kind'
import { parseLessonBlocks } from '@/lib/lesson-blocks'
import { resolveMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

type LessonLike = {
  title: string
  description?: string | null
  content?: unknown
  video_url?: string | null
  resources?: unknown
  metadata?: unknown
}

type Props = {
  lesson: LessonLike
  lessonId: string
  initialPositionSeconds?: number
  onProgress?: (data: VideoProgressData) => void
  onThresholdReached?: () => void
  canGoPrev: boolean
  canGoNext: boolean
  onPrev: () => void
  onNext: () => void
  extraResources?: unknown
  onTakeQuiz?: (quizId: string) => void
  progressById?: Record<string, ActivityProgressItem>
  mandatoryTotal?: number
  mandatoryCompleted?: number
  onMarkDone?: (activityId: string) => void | Promise<void>
  markingActivityId?: string | null
}

export function LessonContentStage({
  lesson,
  lessonId,
  initialPositionSeconds = 0,
  onProgress,
  onThresholdReached,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  extraResources,
  onTakeQuiz,
  progressById,
  mandatoryTotal,
  mandatoryCompleted,
  onMarkDone,
  markingActivityId,
}: Props) {
  const kind = inferLectureKind(lesson)
  const videoUrl = resolveMediaUrl(lesson.video_url) || lesson.video_url || ''
  const hasVideo = Boolean(videoUrl)
  const blocks = parseLessonBlocks(lesson.content)

  return (
    <div className="relative">
      {hasVideo ? (
        <div className="relative bg-black">
          <TrackedVideoPlayer
            key={lessonId}
            videoUrl={videoUrl}
            title={lesson.title}
            initialPositionSeconds={initialPositionSeconds}
            thresholdPercent={90}
            onProgress={onProgress}
            onThresholdReached={onThresholdReached}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 aspect-video">
            <button
              type="button"
              aria-label="Previous lecture"
              disabled={!canGoPrev}
              onClick={onPrev}
              className={cn(
                'pointer-events-auto absolute left-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white sm:flex',
                canGoPrev ? 'hover:bg-black/75' : 'cursor-not-allowed opacity-30'
              )}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              aria-label="Next lecture"
              disabled={!canGoNext}
              onClick={onNext}
              className={cn(
                'pointer-events-auto absolute right-2 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white sm:flex',
                canGoNext ? 'hover:bg-black/75' : 'cursor-not-allowed opacity-30'
              )}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>
      ) : kind === 'resource' ? (
        <div className="min-h-[240px] bg-muted/40 p-4 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Paperclip className="h-4 w-4 text-bhutan-yellow" />
            Lecture resources
          </div>
          <LessonResources
            resources={lesson.resources}
            extraResources={extraResources}
            onTakeQuiz={onTakeQuiz}
            progressById={progressById}
            mandatoryTotal={mandatoryTotal}
            mandatoryCompleted={mandatoryCompleted}
            onMarkDone={onMarkDone}
            markingActivityId={markingActivityId}
          />
        </div>
      ) : (
        <div className="min-h-[240px] space-y-3 bg-muted/30 p-4 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-bhutan-yellow" />
            Article
          </div>
          {lesson.description ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {lesson.description}
            </p>
          ) : null}
          {blocks.length > 0 ? (
            <LessonBlocks
              content={lesson.content}
              lessonId={lessonId}
              onTakeQuiz={onTakeQuiz}
            />
          ) : !lesson.description ? (
            <p className="text-sm text-muted-foreground">
              This lecture has no video yet. Open the resources below for files and activities.
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
