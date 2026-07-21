/**
 * Sequential progression gates for lessons/modules.
 * Settings live in lesson.metadata and module.metadata.
 */

export type ProgressionGateSettings = {
  /** Resources & flashcards stay hidden until the lesson is marked complete */
  gateResourcesUntilComplete: boolean
  /** Next lesson/module stays locked until resources/flashcards are marked done */
  gateNextUntilActivitiesDone: boolean
  /** Module-only: force sequential lesson order across the module */
  sequentialUnlock: boolean
}

export const DEFAULT_GATE_SETTINGS: ProgressionGateSettings = {
  gateResourcesUntilComplete: false,
  gateNextUntilActivitiesDone: false,
  sequentialUnlock: false,
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return {}
}

export function readGateSettings(raw: unknown): Partial<ProgressionGateSettings> {
  const m = asRecord(raw)
  const out: Partial<ProgressionGateSettings> = {}
  if (typeof m.gateResourcesUntilComplete === 'boolean') {
    out.gateResourcesUntilComplete = m.gateResourcesUntilComplete
  }
  if (typeof m.gateNextUntilActivitiesDone === 'boolean') {
    out.gateNextUntilActivitiesDone = m.gateNextUntilActivitiesDone
  }
  if (typeof m.sequentialUnlock === 'boolean') {
    out.sequentialUnlock = m.sequentialUnlock
  }
  return out
}

export function mergeGateSettings(
  moduleMeta: unknown,
  lessonMeta: unknown
): ProgressionGateSettings {
  const mod = readGateSettings(moduleMeta)
  const les = readGateSettings(lessonMeta)
  return {
    gateResourcesUntilComplete:
      les.gateResourcesUntilComplete ??
      mod.gateResourcesUntilComplete ??
      DEFAULT_GATE_SETTINGS.gateResourcesUntilComplete,
    gateNextUntilActivitiesDone:
      les.gateNextUntilActivitiesDone ??
      mod.gateNextUntilActivitiesDone ??
      DEFAULT_GATE_SETTINGS.gateNextUntilActivitiesDone,
    sequentialUnlock:
      les.sequentialUnlock ??
      mod.sequentialUnlock ??
      DEFAULT_GATE_SETTINGS.sequentialUnlock,
  }
}

export function withGateSettings(
  existingMeta: unknown,
  patch: Partial<ProgressionGateSettings>
): Record<string, unknown> {
  return {
    ...asRecord(existingMeta),
    ...patch,
  }
}

export type LessonProgressLite = {
  lesson_id: string
  completed?: boolean | null
  activity_completed?: boolean | null
}

/**
 * Can the student open this lesson (by course-wide ordered list)?
 * First lesson always open. With sequentialUnlock, each prior lesson must be
 * completed, and if that prior lesson gates next-on-activities, activities too.
 */
export function isLessonUnlocked(args: {
  orderedLessonIds: string[]
  targetLessonId: string
  progressByLesson: Map<string, LessonProgressLite>
  /** settings resolved per lesson id */
  settingsForLesson: (lessonId: string) => ProgressionGateSettings
}): boolean {
  const { orderedLessonIds, targetLessonId, progressByLesson, settingsForLesson } = args
  const idx = orderedLessonIds.indexOf(targetLessonId)
  if (idx <= 0) return true

  for (let i = 0; i < idx; i++) {
    const prevId = orderedLessonIds[i]
    const settings = settingsForLesson(prevId)
    // Only enforce chain when sequential unlock is on for the previous (or target's module)
    // Use previous lesson's sequential flag OR the target's — typically module-wide.
    const chain =
      settings.sequentialUnlock || settingsForLesson(targetLessonId).sequentialUnlock
    if (!chain && !settings.gateNextUntilActivitiesDone) {
      // No gating from this previous lesson
      continue
    }

    const prog = progressByLesson.get(prevId)
    const completed = Boolean(prog?.completed)
    if (chain && !completed) return false

    if (settings.gateNextUntilActivitiesDone) {
      if (!completed) return false
      if (!prog?.activity_completed) return false
    }
  }
  return true
}

export function canViewResourcesAndFlashcards(args: {
  settings: ProgressionGateSettings
  lessonCompleted: boolean
}): boolean {
  if (!args.settings.gateResourcesUntilComplete) return true
  return args.lessonCompleted
}

export function canGoToNextLesson(args: {
  settings: ProgressionGateSettings
  lessonCompleted: boolean
  activityCompleted: boolean
}): boolean {
  if (!args.settings.gateNextUntilActivitiesDone && !args.settings.sequentialUnlock) {
    return true
  }
  if (args.settings.sequentialUnlock || args.settings.gateNextUntilActivitiesDone) {
    if (!args.lessonCompleted) return false
  }
  if (args.settings.gateNextUntilActivitiesDone && !args.activityCompleted) {
    return false
  }
  return true
}
