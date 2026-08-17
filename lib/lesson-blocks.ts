export type LessonBlock =
  | { id: string; type: 'text'; html: string }
  | { id: string; type: 'image'; url: string; alt?: string }
  | { id: string; type: 'youtube'; url: string }
  | { id: string; type: 'video'; url: string }
  | { id: string; type: 'accordion'; items: { title: string; html: string }[] }
  | { id: string; type: 'flipcards'; cards: { front: string; back: string }[] }
  | { id: string; type: 'carousel'; slides: { html: string; imageUrl?: string }[] }
  | {
      id: string
      type: 'hotspot'
      imageUrl: string
      spots: { x: number; y: number; label: string; html: string }[]
    }
  | { id: string; type: 'quiz'; quizId: string }
  | { id: string; type: 'assignment'; assignmentId: string }
  | { id: string; type: 'scenario'; scenarioId: string }
  | { id: string; type: 'flashcards'; deckId?: string; cards?: { front: string; back: string }[] }

export type CourseTheme = {
  primary?: string
  heading?: string
  background?: string
  body?: string
  link?: string
  logoUrl?: string
}

export type CourseTutorSettings = {
  name?: string
  photoUrl?: string
  instructions?: string
  enabled?: boolean
}

export type CourseAiMetadata = {
  theme?: CourseTheme
  tutor?: CourseTutorSettings
}

export function newBlockId() {
  return crypto.randomUUID()
}

export function sanitizeHtml(html: string) {
  return String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
}

export function parseLessonBlocks(raw: unknown): LessonBlock[] {
  if (!raw) return []
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return parseLessonBlocks(JSON.parse(trimmed))
      } catch {
        return [{ id: newBlockId(), type: 'text', html: `<p>${escapeText(trimmed)}</p>` }]
      }
    }
    return [{ id: newBlockId(), type: 'text', html: `<p>${escapeText(trimmed)}</p>` }]
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => normalizeBlock(item))
      .filter(Boolean) as LessonBlock[]
  }
  if (typeof raw === 'object') {
    const obj = raw as { blocks?: unknown; html?: string }
    if (Array.isArray(obj.blocks)) return parseLessonBlocks(obj.blocks)
    if (obj.html) return [{ id: newBlockId(), type: 'text', html: sanitizeHtml(obj.html) }]
  }
  return []
}

function escapeText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
}

function normalizeBlock(item: any): LessonBlock | null {
  if (!item || typeof item !== 'object') return null
  const id = typeof item.id === 'string' ? item.id : newBlockId()
  switch (item.type) {
    case 'text':
      return { id, type: 'text', html: sanitizeHtml(item.html || item.content || '') }
    case 'image':
      return { id, type: 'image', url: String(item.url || ''), alt: item.alt }
    case 'youtube':
      return { id, type: 'youtube', url: String(item.url || '') }
    case 'video':
      return { id, type: 'video', url: String(item.url || '') }
    case 'accordion':
      return {
        id,
        type: 'accordion',
        items: Array.isArray(item.items)
          ? item.items.map((row: any) => ({
              title: String(row.title || ''),
              html: sanitizeHtml(row.html || row.content || ''),
            }))
          : [],
      }
    case 'flipcards':
      return {
        id,
        type: 'flipcards',
        cards: Array.isArray(item.cards)
          ? item.cards.map((row: any) => ({
              front: String(row.front || ''),
              back: String(row.back || ''),
            }))
          : [],
      }
    case 'carousel':
      return {
        id,
        type: 'carousel',
        slides: Array.isArray(item.slides)
          ? item.slides.map((row: any) => ({
              html: sanitizeHtml(row.html || row.content || ''),
              imageUrl: row.imageUrl,
            }))
          : [],
      }
    case 'hotspot':
      return {
        id,
        type: 'hotspot',
        imageUrl: String(item.imageUrl || ''),
        spots: Array.isArray(item.spots)
          ? item.spots.map((row: any) => ({
              x: Number(row.x) || 50,
              y: Number(row.y) || 50,
              label: String(row.label || ''),
              html: sanitizeHtml(row.html || ''),
            }))
          : [],
      }
    case 'quiz':
      return { id, type: 'quiz', quizId: String(item.quizId || '') }
    case 'assignment':
      return { id, type: 'assignment', assignmentId: String(item.assignmentId || '') }
    case 'scenario':
      return { id, type: 'scenario', scenarioId: String(item.scenarioId || '') }
    case 'flashcards':
      return {
        id,
        type: 'flashcards',
        deckId: item.deckId,
        cards: Array.isArray(item.cards)
          ? item.cards.map((row: any) => ({
              front: String(row.front || ''),
              back: String(row.back || ''),
            }))
          : [],
      }
    default:
      return null
  }
}

export function youtubeEmbedId(url: string): string | null {
  if (!url) return null
  const m =
    url.match(/(?:youtube\.com\/watch\?v=)([^&]+)/) ||
    url.match(/(?:youtu\.be\/)([^?&]+)/) ||
    url.match(/(?:youtube\.com\/embed\/)([^?&]+)/)
  return m?.[1] || null
}

export function readCourseAiMetadata(raw: unknown): CourseAiMetadata {
  if (!raw || typeof raw !== 'object') return {}
  const meta = raw as CourseAiMetadata
  return {
    theme: meta.theme && typeof meta.theme === 'object' ? meta.theme : undefined,
    tutor: meta.tutor && typeof meta.tutor === 'object' ? meta.tutor : undefined,
  }
}
