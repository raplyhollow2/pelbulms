/**
 * Default landing-page content and parsers for platform_settings JSON fields.
 * Empty/null admin values fall back to these so the public homepage never breaks.
 */

export type LandingStat = { value: string; label: string }

export type LandingFeature = {
  title: string
  description: string
  icon: string
  cta_label?: string
}

export type LandingCampusCard = {
  image_url: string
  title: string
  description: string
}

export type LandingQuote = {
  quote: string
  name: string
  role: string
  stars: number
  avatar_url?: string | null
  course_id?: string | null
}

export type LandingStep = {
  title: string
  description: string
  icon: string
}

export type LandingFaqItem = {
  question: string
  answer: string
}

export type LandingSectionTitles = {
  features_eyebrow?: string
  features_title?: string
  features_subtitle?: string
  steps_eyebrow?: string
  steps_title?: string
  steps_subtitle?: string
  faq_eyebrow?: string
  faq_title?: string
  cta_title?: string
  cta_subtitle?: string
  stats_eyebrow?: string
  campus_title?: string
  quotes_title?: string
}

export const DEFAULT_HERO_VIDEO_URL = 'https://www.youtube.com/watch?v=xpCj64W2Yxs'

export const DEFAULT_HERO_ROTATING_WORDS = [
  'Modern Bhutan',
  'Every Learner',
  'Future Leaders',
  'Gelephu',
  'Our Nation',
]

export const DEFAULT_HERO_CTA_PRIMARY = 'Create your account'

export const DEFAULT_LANDING_STATS: LandingStat[] = [
  { value: '500+', label: 'Learners' },
  { value: '100+', label: 'Courses' },
  { value: '20', label: 'Dzongkhags' },
]

export const DEFAULT_LANDING_FEATURES: LandingFeature[] = [
  {
    icon: 'Lock',
    title: 'Private video lessons',
    description:
      'Lessons play through Pelbu’s servers. The file address stays on the server, and each viewing link expires.',
  },
  {
    icon: 'BarChart3',
    title: 'Real progress tracking',
    description:
      'Watch-time is counted per lesson and playback resumes where you stopped. A lesson completes at 90% watched, after its required activities, and the next lesson can stay locked until then. Your dashboard keeps a day streak and exportable reports.',
  },
  {
    icon: 'BadgeCheck',
    title: 'Verified certificates',
    description:
      'Finishing a course issues a PDF with a unique code and a public page anyone can use to confirm it.',
  },
  {
    icon: 'ScanFace',
    title: 'Bhutan KYC access',
    description:
      'Every account is verified with CID and passport photo, then approved by an assigned reviewer.',
  },
  {
    icon: 'BookOpen',
    title: 'Quizzes and practice',
    description:
      'Graded quizzes, file assignments, flashcards, polls, and branching scenarios, with private notes and a lesson forum beside the video.',
  },
  {
    icon: 'Sparkles',
    title: 'A tutor in the course',
    description:
      'Enrolled learners can ask questions, recap the last lesson, summarize notes, and generate a worksheet. Teachers can draft an outline and quizzes with the same assistant.',
  },
  {
    icon: 'GraduationCap',
    title: 'Effortless authoring',
    description:
      'Teachers build modules, lessons, quizzes, and exams in an autosaving editor.',
  },
  {
    icon: 'Smartphone',
    title: 'Made for your phone',
    description:
      'Install Pelbu from the browser. Fullscreen video turns landscape on a phone and returns to portrait when you leave it.',
  },
]

export const DEFAULT_LANDING_STEPS: LandingStep[] = [
  {
    icon: 'UserPlus',
    title: 'Sign in with Google',
    description: 'Start with a single secure Google sign-in — no passwords to remember.',
  },
  {
    icon: 'ScanFace',
    title: 'Complete Bhutan KYC',
    description:
      'Submit your CID number, CID photo, passport photo and institution — the details that verify you as a genuine learner.',
  },
  {
    icon: 'ShieldCheck',
    title: 'Get approved',
    description:
      'An assigned reviewer confirms student identity. Superadmin confirms instructors and resource persons.',
  },
  {
    icon: 'GraduationCap',
    title: 'Start learning',
    description:
      'After KYC approval you can request a free course. The course creator verifies each enrollment before you can learn.',
  },
]

export const DEFAULT_LANDING_STEPS_NO_KYC: LandingStep[] = [
  {
    icon: 'UserPlus',
    title: 'Sign in with Google',
    description: 'Start with a single secure Google sign-in — no passwords to remember.',
  },
  {
    icon: 'UserPlus',
    title: 'Complete your profile',
    description: 'Choose your institution and role — no CID upload is required right now.',
  },
  {
    icon: 'GraduationCap',
    title: 'Start learning',
    description:
      'Browse the catalog and request a course. The course creator still verifies each enrollment.',
  },
]

export const DEFAULT_LANDING_FAQ: LandingFaqItem[] = [
  {
    question: 'What is Pelbu LMS?',
    answer:
      'Pelbu LMS is Bhutan’s private learning management platform. It offers identity-verified access, private video courses, progress tracking and recognised certificates for students, teachers and institutions.',
  },
  {
    question: 'How do I get access to Pelbu?',
    answer:
      'Sign in with Google, complete the Bhutan KYC registration form (CID number, CID photo, passport photo and your institution), then wait for approval. Students are approved by a resource person or administrator; instructors and resource persons need Superadmin approval. After that, request a course — the course creator still verifies each enrollment.',
  },
  {
    question: 'Why does Pelbu require KYC verification?',
    answer:
      'Pelbu is a closed system for verified learners in Bhutan. KYC verification with CID and passport photo ensures certificates are trustworthy and the network stays free of anonymous or fake accounts.',
  },
  {
    question: 'Are the course videos private?',
    answer:
      'Yes. Videos are stored privately and streamed through Pelbu’s own servers using signed, expiring links. They cannot be downloaded or discovered through the browser’s inspector.',
  },
  {
    question: 'Do I get a certificate?',
    answer:
      'Yes. When you complete a course, Pelbu automatically issues a PDF certificate with a unique code and a public verification page that anyone can use to confirm its authenticity.',
  },
  {
    question: 'Is there an Android app?',
    answer:
      'Install Pelbu from your browser. In Chrome or Edge, use the install prompt, or open the browser menu and choose Install app. On other mobile browsers, use Add to Home Screen.',
  },
]

export const DEFAULT_LANDING_SECTION_TITLES: LandingSectionTitles = {
  features_eyebrow: 'Why Pelbu',
  features_title: 'A learning platform unlike any other',
  features_subtitle: 'Every detail engineered for trust, focus and results — not clutter.',
  steps_eyebrow: 'Getting started',
  steps_title: 'Four steps to join Pelbu',
  steps_subtitle: 'Pelbu is a verified, closed network. Here’s exactly how access works.',
  faq_eyebrow: 'Answers',
  faq_title: 'Frequently asked questions',
  cta_title: 'Ready to learn with the best in Bhutan?',
  cta_subtitle:
    'Join a verified community of learners and educators. Get approved, then start your first course today.',
  stats_eyebrow: 'Across Bhutan',
  campus_title: 'Campus and learning spaces',
  quotes_title: 'Hear from the community',
}

/** Lucide icon keys allowed in admin feature/step editors. */
export const LANDING_ICON_KEYS = [
  'Lock',
  'BarChart3',
  'BadgeCheck',
  'ScanFace',
  'GraduationCap',
  'Sparkles',
  'UserPlus',
  'ShieldCheck',
  'ArrowRight',
  'BookOpen',
  'Users',
  'Award',
  'Video',
  'Smartphone',
  'Globe',
  'Heart',
] as const

export type LandingIconKey = (typeof LANDING_ICON_KEYS)[number]

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function parseLandingStats(raw: unknown): LandingStat[] {
  if (raw == null) return [...DEFAULT_LANDING_STATS]
  if (!Array.isArray(raw) || raw.length === 0) return []
  const parsed = raw
    .map((item) => {
      if (!isRecord(item)) return null
      const value = typeof item.value === 'string' ? item.value.trim() : ''
      const label = typeof item.label === 'string' ? item.label.trim() : ''
      if (!value || !label) return null
      return { value, label }
    })
    .filter((x): x is LandingStat => !!x)
  return parsed.length ? parsed : [...DEFAULT_LANDING_STATS]
}

export function parseLandingFeatures(raw: unknown): LandingFeature[] | null {
  if (raw == null) return null
  if (!Array.isArray(raw)) return null
  if (raw.length === 0) return []
  const parsed = raw
    .map((item) => {
      if (!isRecord(item)) return null
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const description = typeof item.description === 'string' ? item.description.trim() : ''
      const icon = typeof item.icon === 'string' ? item.icon.trim() : 'Sparkles'
      const cta =
        typeof item.cta_label === 'string' && item.cta_label.trim() ? item.cta_label.trim() : undefined
      if (!title || !description) return null
      return { title, description, icon, ...(cta ? { cta_label: cta } : {}) }
    })
    .filter((x): x is LandingFeature => !!x)
  return parsed
}

export function parseLandingSteps(raw: unknown): LandingStep[] | null {
  if (raw == null) return null
  if (!Array.isArray(raw)) return null
  if (raw.length === 0) return []
  const parsed = raw
    .map((item) => {
      if (!isRecord(item)) return null
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const description = typeof item.description === 'string' ? item.description.trim() : ''
      const icon = typeof item.icon === 'string' ? item.icon.trim() : 'UserPlus'
      if (!title || !description) return null
      return { title, description, icon }
    })
    .filter((x): x is LandingStep => !!x)
  return parsed
}

export function parseLandingFaq(raw: unknown): LandingFaqItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const parsed = raw
    .map((item) => {
      if (!isRecord(item)) return null
      const question =
        typeof item.question === 'string'
          ? item.question.trim()
          : typeof item.q === 'string'
            ? item.q.trim()
            : ''
      const answer =
        typeof item.answer === 'string'
          ? item.answer.trim()
          : typeof item.a === 'string'
            ? item.a.trim()
            : ''
      if (!question || !answer) return null
      return { question, answer }
    })
    .filter((x): x is LandingFaqItem => !!x)
  return parsed.length ? parsed : null
}

export function parseLandingSectionTitles(raw: unknown): LandingSectionTitles {
  if (!isRecord(raw)) return {}
  const out: LandingSectionTitles = {}
  const keys: (keyof LandingSectionTitles)[] = [
    'features_eyebrow',
    'features_title',
    'features_subtitle',
    'steps_eyebrow',
    'steps_title',
    'steps_subtitle',
    'faq_eyebrow',
    'faq_title',
    'cta_title',
    'cta_subtitle',
    'stats_eyebrow',
    'campus_title',
    'quotes_title',
  ]
  for (const key of keys) {
    const v = raw[key]
    if (typeof v === 'string' && v.trim()) out[key] = v.trim()
  }
  return out
}

export function parseHeroRotatingWords(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const words = raw
      .filter((w): w is string => typeof w === 'string')
      .map((w) => w.trim())
      .filter(Boolean)
    return words.length ? words : [...DEFAULT_HERO_ROTATING_WORDS]
  }
  if (typeof raw === 'string') {
    const words = raw
      .split(/[\n,]/)
      .map((w) => w.trim())
      .filter(Boolean)
    return words.length ? words : [...DEFAULT_HERO_ROTATING_WORDS]
  }
  return [...DEFAULT_HERO_ROTATING_WORDS]
}

/** Normalize admin PATCH payloads; returns null if invalid. */
export function normalizeLandingStatsInput(raw: unknown): LandingStat[] | null {
  if (!Array.isArray(raw)) return null
  const parsed = raw
    .map((item) => {
      if (!isRecord(item)) return null
      const value = typeof item.value === 'string' ? item.value.trim() : ''
      const label = typeof item.label === 'string' ? item.label.trim() : ''
      if (!value || !label) return null
      return { value, label }
    })
    .filter((x): x is LandingStat => !!x)
  return parsed
}

export function normalizeLandingFeaturesInput(raw: unknown): LandingFeature[] | null {
  if (!Array.isArray(raw)) return null
  return raw
    .map((item) => {
      if (!isRecord(item)) return null
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const description = typeof item.description === 'string' ? item.description.trim() : ''
      const icon = typeof item.icon === 'string' && item.icon.trim() ? item.icon.trim() : 'Sparkles'
      const cta =
        typeof item.cta_label === 'string' && item.cta_label.trim() ? item.cta_label.trim() : undefined
      if (!title || !description) return null
      return { title, description, icon, ...(cta ? { cta_label: cta } : {}) }
    })
    .filter((x): x is LandingFeature => !!x)
}

function cleanUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseLandingCampus(raw: unknown): LandingCampusCard[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!isRecord(item)) return null
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const description = typeof item.description === 'string' ? item.description.trim() : ''
      const image_url = cleanUrl(item.image_url)
      if (!title) return null
      return { image_url, title, description }
    })
    .filter((x): x is LandingCampusCard => !!x)
}

export function parseLandingQuotes(raw: unknown): LandingQuote[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!isRecord(item)) return null
      const quote = typeof item.quote === 'string' ? item.quote.trim() : ''
      const name = typeof item.name === 'string' ? item.name.trim() : ''
      const role = typeof item.role === 'string' ? item.role.trim() : ''
      const starsRaw = Number(item.stars)
      const stars = Number.isFinite(starsRaw) ? Math.min(5, Math.max(1, Math.round(starsRaw))) : 5
      if (!quote || !name) return null
      return { quote, name, role, stars }
    })
    .filter((x): x is LandingQuote => !!x)
}

export function parseLandingGallery(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => (typeof item === 'string' ? item.trim() : isRecord(item) ? cleanUrl(item.image_url) : ''))
    .filter(Boolean)
}

export function normalizeLandingCampusInput(raw: unknown): LandingCampusCard[] | null {
  if (!Array.isArray(raw)) return null
  return parseLandingCampus(raw)
}

export function normalizeLandingQuotesInput(raw: unknown): LandingQuote[] | null {
  if (!Array.isArray(raw)) return null
  return parseLandingQuotes(raw)
}

export function normalizeLandingGalleryInput(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  return parseLandingGallery(raw)
}

export function normalizeLandingStepsInput(raw: unknown): LandingStep[] | null {
  if (!Array.isArray(raw)) return null
  return raw
    .map((item) => {
      if (!isRecord(item)) return null
      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const description = typeof item.description === 'string' ? item.description.trim() : ''
      const icon = typeof item.icon === 'string' && item.icon.trim() ? item.icon.trim() : 'UserPlus'
      if (!title || !description) return null
      return { title, description, icon }
    })
    .filter((x): x is LandingStep => !!x)
}

export function normalizeLandingFaqInput(raw: unknown): LandingFaqItem[] | null {
  if (!Array.isArray(raw)) return null
  return raw
    .map((item) => {
      if (!isRecord(item)) return null
      const question = typeof item.question === 'string' ? item.question.trim() : ''
      const answer = typeof item.answer === 'string' ? item.answer.trim() : ''
      if (!question || !answer) return null
      return { question, answer }
    })
    .filter((x): x is LandingFaqItem => !!x)
}

export function normalizeLandingSectionTitlesInput(raw: unknown): LandingSectionTitles | null {
  if (raw === null) return {}
  if (!isRecord(raw)) return null
  return parseLandingSectionTitles(raw)
}
