import {
  bhutanCertificateLayers,
  defaultCertificateLayout,
  MOLHR_ORNAMENTAL_BORDER,
  newLayerId,
  type CertificateLayer,
  type CertificateLayout,
  type CertShapeKind,
} from '@/lib/certificate-layout'

export type CertAssetCategory = 'templates' | 'text' | 'shapes' | 'decor' | 'uploads'

export type CertTemplateAsset = {
  id: string
  label: string
  description: string
  previewAccent: string
  apply: (current: CertificateLayout) => CertificateLayout
}

export type CertInsertAsset = {
  id: string
  label: string
  category: Exclude<CertAssetCategory, 'templates' | 'uploads'>
  description?: string
  create: (accent: string) => CertificateLayer
}

export const CERT_TEMPLATES: CertTemplateAsset[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Centered title with signature block',
    previewAccent: '#E9B308',
    apply: (current) => {
      const { layers: _omit, backgroundImage: _bg, ...rest } = current
      return defaultCertificateLayout({
        ...rest,
        template: 'classic',
        borderStyle: 'double',
        backgroundImage: undefined,
        tagline: current.tagline || 'This is proudly presented to',
      })
    },
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Clean sans layout, single border',
    previewAccent: '#0f766e',
    apply: (current) => {
      const { layers: _omit, backgroundImage: _bg, ...rest } = current
      const base = defaultCertificateLayout({
        ...rest,
        template: 'modern',
        borderStyle: 'single',
        backgroundImage: undefined,
        accentColor: current.accentColor || '#0f766e',
        backgroundColor: '#f8fafc',
      })
      return {
        ...base,
        layers: base.layers.map((l) => ({
          ...l,
          fontFamily: l.type === 'title' || l.type === 'recipient' ? 'sans' : l.fontFamily,
        })),
      }
    },
  },
  {
    id: 'ornate',
    label: 'Ornate',
    description: 'Decorative border and gold accents',
    previewAccent: '#b45309',
    apply: (current) => {
      const { layers: _omit, backgroundImage: _bg, ...rest } = current
      const base = defaultCertificateLayout({
        ...rest,
        template: 'ornate',
        borderStyle: 'ornate',
        backgroundImage: undefined,
        accentColor: current.accentColor || '#b45309',
      })
      const accent = base.accentColor
      return {
        ...base,
        layers: [
          ...base.layers,
          corner('ornate-tl', 28, 28, accent, 0),
          corner('ornate-tr', 1023, 28, accent, 90),
          corner('ornate-bl', 28, 694, accent, 270),
          corner('ornate-br', 1023, 694, accent, 180),
        ],
      }
    },
  },
  {
    id: 'bhutan',
    label: 'Bhutan Official',
    description: 'MoLHR-style completion certificate',
    previewAccent: '#C5A028',
    apply: (current) => {
      const { layers: _omit, backgroundImage: _bg, ...rest } = current
      return defaultCertificateLayout({
        ...rest,
        template: 'bhutan',
        borderStyle: 'none',
        backgroundImage: undefined,
        accentColor: current.accentColor || '#C5A028',
        backgroundColor: '#fffef8',
        tagline: 'Awarded to',
        layers: bhutanCertificateLayers({
          titleLine: current.titleLine,
          signatureName: current.signatureName,
          signatureTitle: current.signatureTitle,
          accentColor: current.accentColor || '#C5A028',
        }),
      })
    },
  },
  {
    id: 'ornamental',
    label: 'MoLHR Ornamental',
    description: 'Official floral border frame — logos & text free to place',
    previewAccent: '#E9B308',
    apply: (current) => {
      const { layers: _omit, ...rest } = current
      const base = defaultCertificateLayout({
        ...rest,
        template: 'ornamental',
        borderStyle: 'none',
        accentColor: current.accentColor || '#C45C26',
        backgroundColor: '#ffffff',
        backgroundImage: MOLHR_ORNAMENTAL_BORDER,
        tagline: current.tagline || 'Awarded to',
      })
      // Keep content inside the ornamental frame margins
      return {
        ...base,
        backgroundImage: MOLHR_ORNAMENTAL_BORDER,
        borderStyle: 'none',
        layers: base.layers.map((l) => {
          if (l.id === 'title') return { ...l, y: 150, fontFamily: 'serif' as const }
          if (l.id === 'tagline') return { ...l, y: 230 }
          if (l.id === 'recipient') return { ...l, y: 290 }
          if (l.id === 'body') return { ...l, y: 370 }
          if (l.id === 'course') return { ...l, y: 420 }
          if (l.id === 'date') return { ...l, x: 160, y: 600 }
          if (l.id === 'signature') return { ...l, x: 440, y: 560, text: current.signatureName || l.text }
          if (l.id === 'verify') return { ...l, x: 720, y: 600 }
          return l
        }),
        // Preserve uploaded logos; never clear them into the signature block
        logos: current.logos,
        signatureUrl: undefined,
      }
    },
  },
]

function corner(
  id: string,
  x: number,
  y: number,
  accent: string,
  rotation: number
): CertificateLayer {
  return {
    id,
    type: 'shape',
    shape: 'corner',
    x,
    y,
    w: 72,
    h: 72,
    stroke: accent,
    fill: 'transparent',
    strokeWidth: 3,
    rotation,
    zIndex: 2,
  }
}

export const CERT_INSERT_ASSETS: CertInsertAsset[] = [
  {
    id: 'heading',
    label: 'Heading',
    category: 'text',
    description: 'Large title text',
    create: () => ({
      id: newLayerId('text'),
      type: 'text',
      x: 260,
      y: 200,
      w: 600,
      h: 56,
      text: 'Certificate Heading',
      fontSize: 36,
      fontFamily: 'serif',
      fontWeight: 700,
      align: 'center',
      color: '#111827',
      zIndex: 20,
    }),
  },
  {
    id: 'subheading',
    label: 'Subheading',
    category: 'text',
    create: () => ({
      id: newLayerId('text'),
      type: 'text',
      x: 260,
      y: 260,
      w: 600,
      h: 36,
      text: 'Supporting line',
      fontSize: 16,
      fontFamily: 'sans',
      align: 'center',
      color: '#6b7280',
      zIndex: 20,
    }),
  },
  {
    id: 'body-text',
    label: 'Body text',
    category: 'text',
    create: () => ({
      id: newLayerId('text'),
      type: 'text',
      x: 200,
      y: 320,
      w: 720,
      h: 80,
      text: 'Add custom body copy here.',
      fontSize: 14,
      fontFamily: 'sans',
      align: 'center',
      color: '#374151',
      zIndex: 20,
    }),
  },
  {
    id: 'recipient-token',
    label: 'Recipient name',
    category: 'text',
    description: 'Uses {{recipient}} token',
    create: () => ({
      id: newLayerId('recipient'),
      type: 'recipient',
      x: 160,
      y: 280,
      w: 800,
      h: 56,
      text: '{{recipient}}',
      fontSize: 32,
      fontFamily: 'serif',
      fontWeight: 700,
      align: 'center',
      color: '#111827',
      zIndex: 20,
    }),
  },
  {
    id: 'course-token',
    label: 'Course title',
    category: 'text',
    create: () => ({
      id: newLayerId('course'),
      type: 'course',
      x: 160,
      y: 400,
      w: 800,
      h: 44,
      text: '{{course}}',
      fontSize: 22,
      fontFamily: 'serif',
      align: 'center',
      color: '#111827',
      zIndex: 20,
    }),
  },
  {
    id: 'date-token',
    label: 'Date',
    category: 'text',
    create: () => ({
      id: newLayerId('date'),
      type: 'date',
      x: 400,
      y: 500,
      w: 320,
      h: 36,
      text: '{{date}}',
      fontSize: 14,
      fontFamily: 'sans',
      align: 'center',
      color: '#111827',
      zIndex: 20,
    }),
  },
  {
    id: 'cid-token',
    label: 'CID line',
    category: 'text',
    description: 'Uses {{cid}} token',
    create: () => ({
      id: newLayerId('cid'),
      type: 'text',
      x: 260,
      y: 340,
      w: 600,
      h: 28,
      text: 'with CID {{cid}}',
      fontSize: 13,
      fontFamily: 'sans',
      align: 'center',
      color: '#4b5563',
      zIndex: 20,
    }),
  },
  {
    id: 'verify-token',
    label: 'Verification code',
    category: 'text',
    create: () => ({
      id: newLayerId('verify'),
      type: 'verify',
      x: 400,
      y: 700,
      w: 320,
      h: 28,
      text: '{{code}}',
      fontSize: 12,
      fontFamily: 'sans',
      align: 'center',
      color: '#9ca3af',
      zIndex: 20,
    }),
  },
  {
    id: 'rect',
    label: 'Rectangle',
    category: 'shapes',
    create: (accent) => shapeLayer('rect', accent),
  },
  {
    id: 'ellipse',
    label: 'Ellipse',
    category: 'shapes',
    create: (accent) => shapeLayer('ellipse', accent),
  },
  {
    id: 'line',
    label: 'Divider line',
    category: 'shapes',
    create: (accent) => ({
      id: newLayerId('shape'),
      type: 'shape',
      shape: 'line',
      x: 280,
      y: 300,
      w: 560,
      h: 4,
      fill: accent,
      stroke: accent,
      strokeWidth: 2,
      zIndex: 5,
    }),
  },
  {
    id: 'triangle',
    label: 'Triangle',
    category: 'shapes',
    create: (accent) => shapeLayer('triangle', accent),
  },
  {
    id: 'corner-ornament',
    label: 'Corner ornament',
    category: 'decor',
    create: (accent) => ({
      id: newLayerId('corner'),
      type: 'shape',
      shape: 'corner',
      x: 40,
      y: 40,
      w: 80,
      h: 80,
      stroke: accent,
      fill: 'transparent',
      strokeWidth: 3,
      zIndex: 3,
    }),
  },
  {
    id: 'ribbon',
    label: 'Ribbon banner',
    category: 'decor',
    create: (accent) => ({
      id: newLayerId('ribbon'),
      type: 'shape',
      shape: 'ribbon',
      x: 360,
      y: 140,
      w: 400,
      h: 56,
      fill: accent,
      stroke: accent,
      strokeWidth: 0,
      zIndex: 4,
    }),
  },
  {
    id: 'seal',
    label: 'Official seal',
    category: 'decor',
    create: (accent) => ({
      id: newLayerId('seal'),
      type: 'seal',
      x: 500,
      y: 560,
      w: 120,
      h: 120,
      stroke: accent,
      fill: 'transparent',
      strokeWidth: 3,
      color: accent,
      text: 'SEAL',
      fontSize: 12,
      align: 'center',
      zIndex: 15,
    }),
  },
]

function shapeLayer(shape: CertShapeKind, accent: string): CertificateLayer {
  return {
    id: newLayerId('shape'),
    type: 'shape',
    shape,
    x: 460,
    y: 300,
    w: 200,
    h: shape === 'ellipse' ? 140 : 120,
    fill: shape === 'rect' || shape === 'ellipse' ? `${accent}22` : accent,
    stroke: accent,
    strokeWidth: 2,
    zIndex: 5,
  }
}

export const CERT_COLOR_SWATCHES = [
  '#111827',
  '#374151',
  '#6b7280',
  '#ffffff',
  '#E9B308',
  '#C5A028',
  '#b45309',
  '#0f766e',
  '#1d4ed8',
  '#7c2d12',
  '#991b1b',
  '#fffef8',
  '#f8fafc',
  '#fef3c7',
]

export const CERT_BG_PRESETS = [
  { id: 'white', label: 'White', color: '#ffffff' },
  { id: 'ivory', label: 'Ivory', color: '#fffef8' },
  { id: 'cream', label: 'Cream', color: '#fef9ef' },
  { id: 'slate', label: 'Slate mist', color: '#f8fafc' },
  { id: 'gold-wash', label: 'Soft gold', color: '#fffbeb' },
]
