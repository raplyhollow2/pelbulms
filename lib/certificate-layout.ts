export type CertLayerType =
  | 'logo'
  | 'title'
  | 'tagline'
  | 'recipient'
  | 'body'
  | 'course'
  | 'date'
  | 'signature'
  | 'verify'
  | 'text'

export type CertificateLayer = {
  id: string
  type: CertLayerType
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  zIndex?: number
  text?: string
  src?: string
  fontSize?: number
  color?: string
  align?: 'left' | 'center' | 'right'
}

export type CertificateLayout = {
  template: 'classic' | 'modern' | 'ornate'
  borderStyle: 'none' | 'single' | 'double' | 'ornate'
  accentColor: string
  backgroundColor: string
  brandName: string
  titleLine: string
  tagline: string
  signatureName: string
  signatureTitle: string
  signatureUrl?: string
  logos: Array<{ id: string; src: string; x: number; y: number; w: number; h: number }>
  layers: CertificateLayer[]
}

export const CERT_CANVAS = { width: 1123, height: 794 }

export function defaultCertificateLayout(
  partial?: Partial<CertificateLayout>
): CertificateLayout {
  const accent = partial?.accentColor || '#E9B308'
  const brand = partial?.brandName || 'PELBU LMS'
  const titleLine = partial?.titleLine || 'Certificate of Completion'
  const tagline = partial?.tagline || 'This is proudly presented to'
  const signatureName = partial?.signatureName || ''
  const signatureTitle = partial?.signatureTitle || 'Instructor'

  const layers: CertificateLayer[] = [
    {
      id: 'title',
      type: 'title',
      x: 80,
      y: 120,
      w: 960,
      h: 70,
      text: titleLine,
      fontSize: 42,
      align: 'center',
      color: '#111827',
    },
    {
      id: 'tagline',
      type: 'tagline',
      x: 80,
      y: 200,
      w: 960,
      h: 36,
      text: tagline,
      fontSize: 16,
      align: 'center',
      color: '#6b7280',
    },
    {
      id: 'recipient',
      type: 'recipient',
      x: 80,
      y: 280,
      w: 960,
      h: 70,
      text: '{{recipient}}',
      fontSize: 36,
      align: 'center',
      color: '#111827',
    },
    {
      id: 'body',
      type: 'body',
      x: 80,
      y: 360,
      w: 960,
      h: 36,
      text: 'for successfully completing the course',
      fontSize: 14,
      align: 'center',
      color: '#374151',
    },
    {
      id: 'course',
      type: 'course',
      x: 80,
      y: 410,
      w: 960,
      h: 50,
      text: '{{course}}',
      fontSize: 22,
      align: 'center',
      color: '#111827',
    },
    {
      id: 'date',
      type: 'date',
      x: 120,
      y: 620,
      w: 240,
      h: 50,
      text: '{{date}}',
      fontSize: 14,
      align: 'center',
      color: '#111827',
    },
    {
      id: 'signature',
      type: 'signature',
      x: 440,
      y: 580,
      w: 240,
      h: 90,
      text: signatureName || 'Instructor',
      fontSize: 14,
      align: 'center',
      color: '#111827',
    },
    {
      id: 'verify',
      type: 'verify',
      x: 760,
      y: 620,
      w: 240,
      h: 50,
      text: '{{code}}',
      fontSize: 12,
      align: 'center',
      color: '#6b7280',
    },
  ]

  const merged: CertificateLayout = {
    template: 'classic',
    borderStyle: 'double',
    accentColor: accent,
    backgroundColor: '#ffffff',
    brandName: brand,
    titleLine,
    tagline,
    signatureName,
    signatureTitle,
    signatureUrl: undefined,
    logos: [],
    layers,
    ...(partial || {}),
  }
  if (!merged.layers?.length) merged.layers = layers
  if (!merged.logos) merged.logos = []
  return merged
}

export function layoutFromLegacySettings(stored: Record<string, unknown> | null | undefined): CertificateLayout {
  const s = stored || {}
  if (s.layout && typeof s.layout === 'object') {
    return defaultCertificateLayout(s.layout as Partial<CertificateLayout>)
  }
  return defaultCertificateLayout({
    brandName: typeof s.brandName === 'string' ? s.brandName : undefined,
    titleLine: typeof s.titleLine === 'string' ? s.titleLine : undefined,
    accentColor: typeof s.accentColor === 'string' ? s.accentColor : undefined,
    signatureName: typeof s.signatureName === 'string' ? s.signatureName : undefined,
    signatureTitle: typeof s.signatureTitle === 'string' ? s.signatureTitle : undefined,
    logos: typeof s.logoUrl === 'string' && s.logoUrl
      ? [{ id: 'logo-1', src: s.logoUrl as string, x: 80, y: 40, w: 120, h: 60 }]
      : [],
  })
}
