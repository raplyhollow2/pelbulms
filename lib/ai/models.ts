/**
 * Model ids are taken from the installed AI Gateway catalog
 * (`GatewayModelId` in @ai-sdk/gateway). Each family tries its first id,
 * then the next id in the same family.
 */
export const MODEL_FAMILIES = {
  claude: {
    id: 'claude',
    label: 'Claude',
    blurb: 'Long judgment and report reading',
    models: ['anthropic/claude-sonnet-5', 'anthropic/claude-sonnet-4.6'],
  },
  chatgpt: {
    id: 'chatgpt',
    label: 'ChatGPT',
    blurb: 'Structured plans and course outlines',
    models: ['openai/gpt-5.5', 'openai/gpt-5.4'],
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    blurb: 'Fast drafts',
    models: ['google/gemini-3.8-flash', 'google/gemini-3.6-flash'],
  },
} as const

export type ModelFamily = keyof typeof MODEL_FAMILIES

export const MODEL_FAMILY_IDS = Object.keys(MODEL_FAMILIES) as ModelFamily[]

export type AiTask = 'report' | 'report-followup' | 'course-structure'

export const TASK_DEFAULTS: Record<AiTask, ModelFamily> = {
  report: 'claude',
  'report-followup': 'claude',
  'course-structure': 'chatgpt',
}

export type AiModelDefaults = {
  report: ModelFamily
  'course-structure': ModelFamily
}

export const DEFAULT_AI_MODEL_DEFAULTS: AiModelDefaults = {
  report: TASK_DEFAULTS.report,
  'course-structure': TASK_DEFAULTS['course-structure'],
}

export function isModelFamily(value: unknown): value is ModelFamily {
  return value === 'claude' || value === 'chatgpt' || value === 'gemini'
}

export function parseModelFamily(value: unknown, fallback: ModelFamily): ModelFamily {
  return isModelFamily(value) ? value : fallback
}

export function familyOfModel(model: string): ModelFamily {
  if (model.startsWith('openai/')) return 'chatgpt'
  if (model.startsWith('google/')) return 'gemini'
  return 'claude'
}

export function modelsForFamily(family: ModelFamily): readonly string[] {
  return MODEL_FAMILIES[family].models
}

export function modelChain(task: AiTask, family: ModelFamily): string[] {
  const primary = [...modelsForFamily(family)]
  const fallback = TASK_DEFAULTS[task]
  if (fallback === family) return primary
  return [...primary, ...modelsForFamily(fallback)]
}

export function parseAiModelDefaults(raw: unknown): AiModelDefaults {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    report: parseModelFamily(row.report, DEFAULT_AI_MODEL_DEFAULTS.report),
    'course-structure': parseModelFamily(
      row['course-structure'],
      DEFAULT_AI_MODEL_DEFAULTS['course-structure']
    ),
  }
}

export function defaultFamilyForTask(task: AiTask, defaults?: AiModelDefaults | null): ModelFamily {
  if (task === 'course-structure') {
    return defaults?.['course-structure'] || TASK_DEFAULTS['course-structure']
  }
  return defaults?.report || TASK_DEFAULTS.report
}
