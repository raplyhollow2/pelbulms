/**
 * Sequential progression gates for lessons/modules.
 * Settings live in lesson.metadata and module.metadata.
 */

export type LessonCompletionMode = 'auto' | 'manual'

export type ProgressionGateSettings = {
  /** Resources & flashcards stay hidden until the lesson is marked complete */
  gateResourcesUntilComplete: boolean
  /** Next lesson/module stays locked until mandatory activities are done (+ lesson completed) */
  gateNextUntilActivitiesDone: boolean
  /** Module-only: force sequential lesson order across the module */
  sequentialUnlock: boolean
  /**
   * auto = mark lesson complete when video threshold + all mandatory activities done
   * manual = learner must click Complete (still requires mandatory done when gated)
   */
  completionMode: LessonCompletionMode
}

export const DEFAULT_GATE_SETTINGS: ProgressionGateSettings = {
  gateResourcesUntilComplete: false,
  gateNextUntilActivitiesDone: false,
  sequentialUnlock: false,
  completionMode: 'manual',
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
  if (m.completionMode === 'auto' || m.completionMode === 'manual') {
    out.completionMode = m.completionMode
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
    completionMode:
      les.completionMode ?? mod.completionMode ?? DEFAULT_GATE_SETTINGS.completionMode,
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
    const chain =
      settings.sequentialUnlock || settingsForLesson(targetLessonId).sequentialUnlock
    if (!chain && !settings.gateNextUntilActivitiesDone) {
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

/** True when there are no mandatory activities, or all of them are completed. */
export function areMandatoryActivitiesDone(args: {
  mandatoryCount: number
  completedMandatoryCount: number
}): boolean {
  if (args.mandatoryCount <= 0) return true
  return args.completedMandatoryCount >= args.mandatoryCount
}
