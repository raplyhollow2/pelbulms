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
  | 'shape'
  | 'image'
  | 'line'
  | 'seal'

export type CertShapeKind = 'rect' | 'ellipse' | 'line' | 'triangle' | 'ribbon' | 'corner'

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
  fontFamily?: 'serif' | 'sans' | 'script'
  fontWeight?: number | string
  color?: string
  align?: 'left' | 'center' | 'right'
  shape?: CertShapeKind
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  locked?: boolean
  letterSpacing?: number
  /** Role line under a signature name. */
  subtitle?: string
}

export type CertificateSigner = {
  id: string
  name: string
  title: string
  imageUrl?: string
  userId?: string
}

export const PRIMARY_SIGNER_ID = 'primary'

export type CertificateTemplateId = 'classic' | 'modern' | 'ornate' | 'bhutan' | 'ornamental'

export type CertificateLayout = {
  template: CertificateTemplateId
  borderStyle: 'none' | 'single' | 'double' | 'ornate'
  accentColor: string
  backgroundColor: string
  /** Full-bleed decorative frame (e.g. MoLHR ornamental border) */
  backgroundImage?: string
  brandName: string
  titleLine: string
  tagline: string
  signatureName: string
  signatureTitle: string
  /** Resource persons printed on the certificate. The first person mirrors signatureName. */
  signers?: CertificateSigner[]
  /** @deprecated Prefer an independent logo/image on the canvas — do not bind to name text */
  signatureUrl?: string
  logos: Array<{ id: string; src: string; x: number; y: number; w: number; h: number }>
  layers: CertificateLayer[]
}

/** Bundled MoLHR ornamental certificate frame (JPEG bytes; keep .jpg extension) */
export const MOLHR_ORNAMENTAL_BORDER = '/certificates/molhr-ornamental-border.jpg'

export const CERT_CANVAS = { width: 1123, height: 794 }

export const CERT_FONTS = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  script: '"Palatino Linotype", Palatino, "Brush Script MT", cursive',
} as const

function classicLayers(opts: {
  titleLine: string
  tagline: string
  signatureName: string
}): CertificateLayer[] {
  const { titleLine, tagline, signatureName } = opts
  return [
    {
      id: 'title',
      type: 'title',
      x: 80,
      y: 120,
      w: 960,
      h: 70,
      text: titleLine,
      fontSize: 42,
      fontFamily: 'serif',
      align: 'center',
      color: '#111827',
      zIndex: 10,
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
      fontFamily: 'sans',
      align: 'center',
      color: '#6b7280',
      zIndex: 10,
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
      fontFamily: 'serif',
      align: 'center',
      color: '#111827',
      zIndex: 10,
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
      fontFamily: 'sans',
      align: 'center',
      color: '#374151',
      zIndex: 10,
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
      fontFamily: 'serif',
      align: 'center',
      color: '#111827',
      zIndex: 10,
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
      fontFamily: 'sans',
      align: 'center',
      color: '#111827',
      zIndex: 10,
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
      fontFamily: 'sans',
      align: 'center',
      color: '#111827',
      zIndex: 10,
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
      fontFamily: 'sans',
      align: 'center',
      color: '#6b7280',
      zIndex: 10,
    },
  ]
}

/** Layout inspired by MoLHR / DWPSD completion certificates */
export function bhutanCertificateLayers(opts?: {
  titleLine?: string
  signatureName?: string
  signatureTitle?: string
  accentColor?: string
}): CertificateLayer[] {
  const accent = opts?.accentColor || '#C5A028'
  const titleLine = opts?.titleLine || 'Certificate of Completion'
  const signatureName = opts?.signatureName || 'Director'
  const signatureTitle = opts?.signatureTitle || 'Director, DWPSD'

  return [
    {
      id: 'org-line-1',
      type: 'text',
      x: 160,
      y: 48,
      w: 800,
      h: 28,
      text: 'Royal Government of Bhutan',
      fontSize: 15,
      fontFamily: 'serif',
      fontWeight: 600,
      align: 'center',
      color: '#1a1a1a',
      zIndex: 10,
    },
    {
      id: 'org-line-2',
      type: 'text',
      x: 160,
      y: 76,
      w: 800,
      h: 24,
      text: 'Ministry of Labour and Human Resources',
      fontSize: 13,
      fontFamily: 'sans',
      align: 'center',
      color: '#333333',
      zIndex: 10,
    },
    {
      id: 'org-line-3',
      type: 'text',
      x: 160,
      y: 100,
      w: 800,
      h: 22,
      text: 'Department of Workforce Planning and Skills Development',
      fontSize: 12,
      fontFamily: 'sans',
      align: 'center',
      color: '#4b5563',
      zIndex: 10,
    },
    {
      id: 'divider-top',
      type: 'shape',
      shape: 'line',
      x: 280,
      y: 132,
      w: 560,
      h: 2,
      fill: accent,
      stroke: accent,
      strokeWidth: 2,
      zIndex: 5,
    },
    {
      id: 'title',
      type: 'title',
      x: 80,
      y: 150,
      w: 960,
      h: 56,
      text: titleLine,
      fontSize: 36,
      fontFamily: 'serif',
      fontWeight: 700,
      align: 'center',
      color: '#111827',
      letterSpacing: 1,
      zIndex: 10,
    },
    {
      id: 'tagline',
      type: 'tagline',
      x: 80,
      y: 214,
      w: 960,
      h: 28,
      text: 'Awarded to',
      fontSize: 14,
      fontFamily: 'sans',
      align: 'center',
      color: '#6b7280',
      zIndex: 10,
    },
    {
      id: 'recipient',
      type: 'recipient',
      x: 80,
      y: 248,
      w: 960,
      h: 48,
      text: '{{recipient}}',
      fontSize: 32,
      fontFamily: 'serif',
      fontWeight: 700,
      align: 'center',
      color: '#111827',
      zIndex: 10,
    },
    {
      id: 'cid-line',
      type: 'text',
      x: 80,
      y: 300,
      w: 960,
      h: 24,
      text: 'with CID {{cid}}',
      fontSize: 13,
      fontFamily: 'sans',
      align: 'center',
      color: '#4b5563',
      zIndex: 10,
    },
    {
      id: 'body',
      type: 'body',
      x: 120,
      y: 340,
      w: 880,
      h: 28,
      text: 'for successfully completing Critical Capability Development (CCD) program on',
      fontSize: 13,
      fontFamily: 'sans',
      align: 'center',
      color: '#374151',
      zIndex: 10,
    },
    {
      id: 'course',
      type: 'course',
      x: 80,
      y: 376,
      w: 960,
      h: 40,
      text: '{{course}}',
      fontSize: 22,
      fontFamily: 'serif',
      fontWeight: 700,
      align: 'center',
      color: '#111827',
      zIndex: 10,
    },
    {
      id: 'date-range',
      type: 'date',
      x: 120,
      y: 430,
      w: 880,
      h: 28,
      text: 'from {{date}}',
      fontSize: 13,
      fontFamily: 'sans',
      align: 'center',
      color: '#374151',
      zIndex: 10,
    },
    {
      id: 'conducted-by',
      type: 'text',
      x: 120,
      y: 468,
      w: 880,
      h: 48,
      text: 'Conducted by the training partner at the designated venue,\nfunded under the programme sponsoring agency.',
      fontSize: 12,
      fontFamily: 'sans',
      align: 'center',
      color: '#4b5563',
      zIndex: 10,
    },
    {
      id: 'sig-line-left',
      type: 'shape',
      shape: 'line',
      x: 160,
      y: 620,
      w: 220,
      h: 2,
      fill: '#9ca3af',
      stroke: '#9ca3af',
      strokeWidth: 1,
      zIndex: 5,
    },
    {
      id: 'sig-line-right',
      type: 'shape',
      shape: 'line',
      x: 740,
      y: 620,
      w: 220,
      h: 2,
      fill: '#9ca3af',
      stroke: '#9ca3af',
      strokeWidth: 1,
      zIndex: 5,
    },
    {
      id: 'signature',
      type: 'signature',
      x: 140,
      y: 560,
      w: 260,
      h: 100,
      text: signatureName,
      fontSize: 13,
      fontFamily: 'sans',
      align: 'center',
      color: '#111827',
      zIndex: 10,
    },
    {
      id: 'signature-2',
      type: 'text',
      x: 720,
      y: 630,
      w: 260,
      h: 50,
      text: `${signatureTitle}\n(Co-signatory)`,
      fontSize: 12,
      fontFamily: 'sans',
      align: 'center',
      color: '#111827',
      zIndex: 10,
    },
    {
      id: 'verify',
      type: 'verify',
      x: 400,
      y: 720,
      w: 320,
      h: 28,
      text: 'Verification: {{code}}',
      fontSize: 11,
      fontFamily: 'sans',
      align: 'center',
      color: '#9ca3af',
      zIndex: 10,
    },
    {
      id: 'corner-tl',
      type: 'shape',
      shape: 'corner',
      x: 36,
      y: 36,
      w: 72,
      h: 72,
      stroke: accent,
      fill: 'transparent',
      strokeWidth: 3,
      rotation: 0,
      zIndex: 2,
    },
    {
      id: 'corner-tr',
      type: 'shape',
      shape: 'corner',
      x: 1015,
      y: 36,
      w: 72,
      h: 72,
      stroke: accent,
      fill: 'transparent',
      strokeWidth: 3,
      rotation: 90,
      zIndex: 2,
    },
    {
      id: 'corner-bl',
      type: 'shape',
      shape: 'corner',
      x: 36,
      y: 686,
      w: 72,
      h: 72,
      stroke: accent,
      fill: 'transparent',
      strokeWidth: 3,
      rotation: 270,
      zIndex: 2,
    },
    {
      id: 'corner-br',
      type: 'shape',
      shape: 'corner',
      x: 1015,
      y: 686,
      w: 72,
      h: 72,
      stroke: accent,
      fill: 'transparent',
      strokeWidth: 3,
      rotation: 180,
      zIndex: 2,
    },
  ]
}

export function defaultCertificateLayout(
  partial?: Partial<CertificateLayout>
): CertificateLayout {
  const accent = partial?.accentColor || '#E9B308'
  const brand = partial?.brandName || 'RIGBU LMS'
  const titleLine = partial?.titleLine || 'Certificate of Completion'
  const tagline = partial?.tagline || 'This is proudly presented to'
  const signatureName = partial?.signatureName || ''
  const signatureTitle = partial?.signatureTitle || 'Instructor'
  const template = partial?.template || 'ornamental'

  const layers =
    template === 'bhutan'
      ? bhutanCertificateLayers({ titleLine, signatureName, signatureTitle, accentColor: accent })
      : classicLayers({ titleLine, tagline, signatureName })

  const merged: CertificateLayout = {
    template,
    borderStyle: template === 'bhutan' || template === 'ornamental' ? 'none' : 'double',
    accentColor: accent,
    backgroundColor: '#ffffff',
    backgroundImage: template === 'ornamental' ? MOLHR_ORNAMENTAL_BORDER : undefined,
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

  // Migrate legacy signatureUrl into a free-floating canvas logo so it is not
  // glued to the instructor-name text layer.
  if (merged.signatureUrl) {
    const already = merged.logos.some((l) => l.src === merged.signatureUrl)
    if (!already) {
      const sigLayer = merged.layers.find((l) => l.type === 'signature')
      merged.logos = [
        ...merged.logos,
        {
          id: 'sig-image-migrated',
          src: merged.signatureUrl,
          x: sigLayer ? sigLayer.x + Math.max(0, (sigLayer.w - 180) / 2) : 470,
          y: sigLayer ? Math.max(40, sigLayer.y - 70) : 520,
          w: 180,
          h: 64,
        },
      ]
    }
    merged.signatureUrl = undefined
  }

  return merged
}

export function layoutFromLegacySettings(
  stored: Record<string, unknown> | null | undefined
): CertificateLayout {
  const s = stored || {}
  if (s.layout && typeof s.layout === 'object') {
    const layout = defaultCertificateLayout(s.layout as Partial<CertificateLayout>)
    return layoutWithSigners(layout, signersFromLayout(layout))
  }
  const layout = defaultCertificateLayout({
    brandName: typeof s.brandName === 'string' ? s.brandName : undefined,
    titleLine: typeof s.titleLine === 'string' ? s.titleLine : undefined,
    accentColor: typeof s.accentColor === 'string' ? s.accentColor : undefined,
    signatureName: typeof s.signatureName === 'string' ? s.signatureName : undefined,
    signatureTitle: typeof s.signatureTitle === 'string' ? s.signatureTitle : undefined,
    logos:
      typeof s.logoUrl === 'string' && s.logoUrl
        ? [{ id: 'logo-1', src: s.logoUrl as string, x: 80, y: 40, w: 120, h: 60 }]
        : [],
  })
  return layoutWithSigners(layout, signersFromLayout(layout))
}

export function newLayerId(prefix = 'el') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function signatureLayerId(signerId: string) {
  return signerId === PRIMARY_SIGNER_ID ? 'signature' : `signature-${signerId}`
}

export function signatureImageId(signerId: string) {
  return `sig-image-${signerId}`
}

export function signersFromLayout(layout: CertificateLayout): CertificateSigner[] {
  if (Array.isArray(layout.signers)) return layout.signers
  const layer =
    layout.layers.find((item) => item.id === 'signature' && item.type === 'signature') ||
    layout.layers.find((item) => item.type === 'signature')
  const image = layout.logos.find((item) => item.id.startsWith('sig-image'))
  return [
    {
      id: PRIMARY_SIGNER_ID,
      name: layout.signatureName || layer?.text || '',
      title: layout.signatureTitle || layer?.subtitle || 'Instructor',
      imageUrl: image?.src,
    },
  ]
}

function signerFrame(index: number, count: number) {
  const margin = 64
  const usable = CERT_CANVAS.width - margin * 2
  const column = usable / Math.max(count, 1)
  const w = Math.min(220, Math.max(140, column - 16))
  const x = margin + index * column + (column - w) / 2
  const y = 560
  return {
    x,
    y,
    w,
    h: 96,
    imageX: x + (w - 150) / 2,
    imageY: Math.max(40, y - 62),
    imageW: 150,
    imageH: 52,
  }
}

/** Write each resource person onto their own signature block. */
export function layoutWithSigners(
  layout: CertificateLayout,
  signers: CertificateSigner[],
  options?: { relayout?: boolean }
): CertificateLayout {
  const people = signers
  const relayout = options?.relayout === true
  const layerIds = new Set(people.map((person) => signatureLayerId(person.id)))
  let layers = layout.layers.filter((layer) => {
    if (layer.id === 'signature-2' && layer.type === 'text') return false
    if (layer.type === 'signature' && !layerIds.has(layer.id)) return false
    return true
  })

  people.forEach((person, index) => {
    const id = signatureLayerId(person.id)
    const frame = signerFrame(index, people.length)
    const existing = layers.find((layer) => layer.id === id)
    const keepBox = existing && (!relayout || people.length === 1)
    const next: CertificateLayer = {
      ...(existing || {}),
      id,
      type: 'signature',
      x: keepBox ? existing.x : frame.x,
      y: keepBox ? existing.y : frame.y,
      w: keepBox ? existing.w : frame.w,
      h: keepBox ? existing.h : frame.h,
      text: person.name,
      subtitle: person.title,
      fontSize: existing?.fontSize || 14,
      fontFamily: existing?.fontFamily || 'sans',
      align: 'center',
      color: existing?.color || '#111827',
      zIndex: existing?.zIndex ?? 10,
    }
    layers = existing ? layers.map((layer) => (layer.id === id ? next : layer)) : [...layers, next]
  })

  const logos = layout.logos.filter((logo) => !logo.id.startsWith('sig-image'))
  people.forEach((person, index) => {
    if (!person.imageUrl) return
    const frame = signerFrame(index, people.length)
    const id = signatureImageId(person.id)
    const existing =
      layout.logos.find((logo) => logo.id === id) ||
      (person.id === PRIMARY_SIGNER_ID
        ? layout.logos.find((logo) => logo.id.startsWith('sig-image'))
        : undefined)
    const signatureLayer = layers.find((layer) => layer.id === signatureLayerId(person.id))
    const keepBox = existing && (!relayout || people.length === 1)
    const imageW = keepBox ? existing.w : frame.imageW
    const imageH = keepBox ? existing.h : frame.imageH
    logos.push({
      id,
      src: person.imageUrl,
      x: keepBox ? existing.x : signatureLayer ? signatureLayer.x + (signatureLayer.w - imageW) / 2 : frame.imageX,
      y: keepBox ? existing.y : signatureLayer ? Math.max(40, signatureLayer.y - imageH - 8) : frame.imageY,
      w: imageW,
      h: imageH,
    })
  })

  const first = people[0]
  return {
    ...layout,
    signers: people,
    signatureName: first?.name || '',
    signatureTitle: first?.title || '',
    signatureUrl: undefined,
    layers,
    logos,
  }
}

/** After a template change, keep every resource person and place their blocks again. */
export function retainResourcePersons(built: CertificateLayout, current: CertificateLayout) {
  return layoutWithSigners(
    { ...built, logos: current.logos.length ? current.logos : built.logos },
    signersFromLayout(current),
    { relayout: true }
  )
}

export function syncSignersFromLayers(layout: CertificateLayout): CertificateLayout {
  if (!Array.isArray(layout.signers)) return layoutWithSigners(layout, signersFromLayout(layout))
  const signers = layout.signers.map((signer) => {
    const layer = layout.layers.find((item) => item.id === signatureLayerId(signer.id))
    if (!layer) return signer
    return {
      ...signer,
      name: layer.text ?? signer.name,
      title: layer.subtitle ?? signer.title,
    }
  })
  const first = signers[0]
  return {
    ...layout,
    signers,
    signatureName: first?.name || '',
    signatureTitle: first?.title || layout.signatureTitle,
  }
}

export function resolveCertificateText(
  raw: string | undefined,
  sample: { name: string; course: string; date?: string; code?: string; cid?: string }
) {
  return (raw || '')
    .replace(/\{\{recipient\}\}/g, sample.name)
    .replace(/\{\{course\}\}/g, sample.course)
    .replace(/\{\{date\}\}/g, sample.date || new Date().toLocaleDateString())
    .replace(/\{\{code\}\}/g, sample.code || 'CERT-PREVIEW')
    .replace(/\{\{cid\}\}/g, sample.cid || '11805002729')
}
