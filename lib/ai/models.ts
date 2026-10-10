/** School-wide language models. Users do not pick among these. */

export const LLM_PROVIDERS = ['claude', 'gemini', 'chatgpt', 'copilot'] as const

export type LlmProvider = (typeof LLM_PROVIDERS)[number]

/** Stored on report briefs. Same ids as the four providers. */
export type ModelFamily = LlmProvider

export const AI_FEATURES = [
  'tutor',
  'quiz',
  'course-generate',
  'course-edit',
  'extract',
  'image',
  'course-structure',
  'report',
  'report-followup',
  'email-template',
] as const

export type AiFeature = (typeof AI_FEATURES)[number]

export type AiFeatureRoutes = Record<AiFeature, LlmProvider>

export const PROVIDER_LABELS: Record<LlmProvider, string> = {
  claude: 'Claude',
  gemini: 'Gemini',
  chatgpt: 'ChatGPT',
  copilot: 'Microsoft Copilot',
}

export const FEATURE_LABELS: Record<AiFeature, string> = {
  tutor: 'Course tutor',
  quiz: 'Quiz generation',
  'course-generate': 'Course generation',
  'course-edit': 'Lesson editing',
  extract: 'Source extract',
  image: 'Image generation',
  'course-structure': 'Course structure',
  report: 'Report reading',
  'report-followup': 'Report follow-up',
  'email-template': 'Email template draft',
}

/** Curated text models. Copilot uses the school's Azure deployment name instead. */
export const PROVIDER_MODELS: Record<Exclude<LlmProvider, 'copilot'>, readonly string[]> = {
  claude: ['claude-sonnet-5', 'claude-sonnet-4.6'],
  chatgpt: ['gpt-5.5', 'gpt-5.4'],
  gemini: ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'],
}

export const CHATGPT_IMAGE_MODEL = 'gpt-image-2'

export const DEFAULT_FEATURE_ROUTES: AiFeatureRoutes = {
  tutor: 'gemini',
  quiz: 'gemini',
  'course-generate': 'gemini',
  'course-edit': 'gemini',
  extract: 'gemini',
  image: 'gemini',
  'course-structure': 'chatgpt',
  report: 'claude',
  'report-followup': 'claude',
  'email-template': 'gemini',
}

export function isLlmProvider(value: unknown): value is LlmProvider {
  return value === 'claude' || value === 'gemini' || value === 'chatgpt' || value === 'copilot'
}

export function providersForFeature(feature: AiFeature): LlmProvider[] {
  if (feature === 'image') return ['gemini', 'chatgpt', 'copilot']
  return [...LLM_PROVIDERS]
}

export function parseFeatureRoutes(raw: unknown): AiFeatureRoutes {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const next = { ...DEFAULT_FEATURE_ROUTES }
  for (const feature of AI_FEATURES) {
    const value = row[feature]
    if (!isLlmProvider(value)) continue
    if (feature === 'image' && value === 'claude') continue
    next[feature] = value
  }
  return next
}

export function modelChain(provider: LlmProvider, selected?: string | null): string[] {
  if (provider === 'copilot') {
    const deployment = selected?.trim()
    return deployment ? [deployment] : []
  }
  const catalog = [...PROVIDER_MODELS[provider]]
  const first = selected?.trim()
  if (first && catalog.includes(first)) {
    return [first, ...catalog.filter((id) => id !== first)]
  }
  if (first) return [first, ...catalog.filter((id) => id !== first)]
  return catalog
}
