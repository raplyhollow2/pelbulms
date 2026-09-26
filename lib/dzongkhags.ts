/** Official dzongkhag names used on registration and in the user editor. */
export const DZONGKHAGS = [
  'Bumthang',
  'Chhukha',
  'Dagana',
  'Gasa',
  'Haa',
  'Lhuentse',
  'Mongar',
  'Paro',
  'Pemagatshel',
  'Punakha',
  'Samdrup Jongkhar',
  'Samtse',
  'Sarpang',
  'Thimphu',
  'Trashigang',
  'Trashiyangtse',
  'Trongsa',
  'Tsirang',
  'Wangdue Phodrang',
  'Zhemgang',
] as const

export type Dzongkhag = (typeof DZONGKHAGS)[number]

const LEGACY_DZONGKHAGS: Record<string, Dzongkhag> = {
  Chukha: 'Chhukha',
  'Pema Gatshel': 'Pemagatshel',
  Pemagatshel: 'Pemagatshel',
  'Pema-Gatshel': 'Pemagatshel',
}

export function normalizeDzongkhag(value: string | null | undefined): string {
  const trimmed = (value || '').replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  if ((DZONGKHAGS as readonly string[]).includes(trimmed)) return trimmed
  return LEGACY_DZONGKHAGS[trimmed] || ''
}
