import React from 'react'
import fs from 'fs'
import path from 'path'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Svg,
  Circle,
  Polygon,
  Path,
  Line,
  renderToBuffer,
} from '@react-pdf/renderer'
import {
  defaultCertificateLayout,
  layoutFromLegacySettings,
  type CertificateLayout,
  type CertificateLayer,
} from '@/lib/certificate-layout'

export interface CertificateDesignSettings {
  brandName?: string
  titleLine?: string
  accentColor?: string
  signatureName?: string
  signatureTitle?: string
  logoUrl?: string
  layout?: CertificateLayout
}

export interface CertificateData {
  recipientName: string
  courseTitle: string
  issuedDate: string
  verificationCode: string
  verifyUrl: string
  instructorName?: string
  cid?: string
  design?: CertificateDesignSettings
}

const PAGE = { w: 842, h: 595 }
const CANVAS = { w: 1123, h: 794 }

function sx(n: number) {
  return (n / CANVAS.w) * PAGE.w
}
function sy(n: number) {
  return (n / CANVAS.h) * PAGE.h
}

/** Resolve public/ relative paths for @react-pdf Image */
function resolvePdfImageSrc(src: string): string {
  if (!src) return src
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return src
  }
  try {
    const filePath = path.join(process.cwd(), 'public', src.replace(/^\//, ''))
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath)
      const ext = path.extname(filePath).slice(1).toLowerCase() || 'png'
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext
      return `data:image/${mime};base64,${buf.toString('base64')}`
    }
  } catch {
    /* fall through */
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  if (base) {
    const origin = base.startsWith('http') ? base : `https://${base}`
    return `${origin.replace(/\/$/, '')}${src.startsWith('/') ? src : `/${src}`}`
  }
  return src
}

function resolve(text: string | undefined, data: CertificateData) {
  return (text || '')
    .replace(/\{\{recipient\}\}/g, data.recipientName)
    .replace(/\{\{course\}\}/g, data.courseTitle)
    .replace(/\{\{date\}\}/g, data.issuedDate)
    .replace(/\{\{code\}\}/g, data.verificationCode)
    .replace(/\{\{cid\}\}/g, data.cid || '')
}

function fontFamily(layer: CertificateLayer) {
  if (layer.fontFamily === 'serif') return 'Times-Roman'
  if (layer.fontFamily === 'script') return 'Times-Italic'
  return layer.type === 'title' || layer.type === 'recipient' ? 'Helvetica-Bold' : 'Helvetica'
}

function ShapeLayer({
  layer,
  accent,
}: {
  layer: CertificateLayer
  accent: string
}) {
  const fill = layer.fill && layer.fill !== 'transparent' ? layer.fill : 'transparent'
  const stroke = layer.stroke || accent
  const sw = layer.strokeWidth ?? 2
  const box = {
    position: 'absolute' as const,
    left: sx(layer.x),
    top: sy(layer.y),
    width: sx(layer.w),
    height: sy(layer.h),
  }

  if (layer.shape === 'ellipse') {
    return (
      <View style={box}>
        <Svg width={sx(layer.w)} height={sy(layer.h)} viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="48" fill={fill} stroke={stroke} strokeWidth={sw} />
        </Svg>
      </View>
    )
  }
  if (layer.shape === 'line') {
    return (
      <View style={box}>
        <Svg width={sx(layer.w)} height={sy(Math.max(layer.h, 4))} viewBox={`0 0 ${layer.w} 4`}>
          <Line x1="0" y1="2" x2={layer.w} y2="2" stroke={stroke} strokeWidth={sw} />
        </Svg>
      </View>
    )
  }
  if (layer.shape === 'triangle') {
    return (
      <View style={box}>
        <Svg width={sx(layer.w)} height={sy(layer.h)} viewBox="0 0 100 100">
          <Polygon points="50,5 95,95 5,95" fill={fill} stroke={stroke} strokeWidth={sw} />
        </Svg>
      </View>
    )
  }
  if (layer.shape === 'ribbon') {
    return (
      <View style={box}>
        <Svg width={sx(layer.w)} height={sy(layer.h)} viewBox="0 0 200 40">
          <Path
            d="M10 0 H190 L200 20 L190 40 H10 L0 20 Z"
            fill={fill === 'transparent' ? stroke : fill}
          />
        </Svg>
      </View>
    )
  }
  if (layer.shape === 'corner') {
    return (
      <View style={box}>
        <Svg width={sx(layer.w)} height={sy(layer.h)} viewBox="0 0 72 72">
          <Path d="M8 64 V8 H64" stroke={stroke} strokeWidth={sw} fill="none" />
          <Path d="M20 64 V20 H64" stroke={stroke} strokeWidth={Math.max(1, sw - 1)} fill="none" />
        </Svg>
      </View>
    )
  }
  return (
    <View
      style={{
        ...box,
        backgroundColor: fill === 'transparent' ? undefined : fill,
        borderWidth: sw,
        borderColor: stroke,
      }}
    />
  )
}

function CertificateDocument(data: CertificateData) {
  const layout = data.design?.layout
    ? defaultCertificateLayout(data.design.layout)
    : layoutFromLegacySettings(data.design as any)
  const accent = layout.accentColor || '#E9B308'
  const borderW =
    layout.borderStyle === 'none'
      ? 0
      : layout.borderStyle === 'ornate'
        ? 8
        : layout.borderStyle === 'double'
          ? 4
          : 3

  const styles = StyleSheet.create({
    page: {
      backgroundColor: layout.backgroundColor || '#ffffff',
      padding: 18,
    },
    frame: {
      flex: 1,
      borderWidth: borderW,
      borderColor: accent,
      borderStyle: layout.borderStyle === 'double' ? 'dashed' : 'solid',
      position: 'relative',
    },
  })

  const layers = [...layout.layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))

  return (
    <Document title={`Certificate - ${data.courseTitle}`} author={layout.brandName}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          {layout.backgroundImage ? (
            <Image
              src={resolvePdfImageSrc(layout.backgroundImage)}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: PAGE.w - 36,
                height: PAGE.h - 36,
                objectFit: 'fill',
              }}
            />
          ) : null}
          {layout.logos.map((logo) =>
            logo.src ? (
              <Image
                key={logo.id}
                src={resolvePdfImageSrc(logo.src)}
                style={{
                  position: 'absolute',
                  left: sx(logo.x),
                  top: sy(logo.y),
                  width: sx(logo.w),
                  height: sy(logo.h),
                  objectFit: 'contain',
                }}
              />
            ) : null
          )}
          {layers.map((layer) => {
            if (layer.type === 'shape') {
              return <ShapeLayer key={layer.id} layer={layer} accent={accent} />
            }
            if (layer.type === 'seal') {
              const stroke = layer.stroke || accent
              return (
                <View
                  key={layer.id}
                  style={{
                    position: 'absolute',
                    left: sx(layer.x),
                    top: sy(layer.y),
                    width: sx(layer.w),
                    height: sy(layer.h),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Svg width={sx(layer.w)} height={sy(layer.h)} viewBox="0 0 100 100">
                    <Circle cx="50" cy="50" r="46" fill="none" stroke={stroke} strokeWidth="3" />
                    <Circle cx="50" cy="50" r="38" fill="none" stroke={stroke} strokeWidth="1.5" />
                  </Svg>
                  <Text
                    style={{
                      position: 'absolute',
                      fontSize: 8,
                      color: stroke,
                      textAlign: 'center',
                    }}
                  >
                    {layer.text || 'SEAL'}
                  </Text>
                </View>
              )
            }
            if (layer.type === 'image' && layer.src) {
              return (
                <Image
                  key={layer.id}
                  src={layer.src}
                  style={{
                    position: 'absolute',
                    left: sx(layer.x),
                    top: sy(layer.y),
                    width: sx(layer.w),
                    height: sy(layer.h),
                    objectFit: 'contain',
                  }}
                />
              )
            }
            if (layer.type === 'signature') {
              return (
                <View
                  key={layer.id}
                  style={{
                    position: 'absolute',
                    left: sx(layer.x),
                    top: sy(layer.y),
                    width: sx(layer.w),
                    height: sy(layer.h),
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}
                >
                  <Text style={{ fontSize: 10, textAlign: 'center' }}>
                    {layout.signatureName || data.instructorName || resolve(layer.text, data)}
                  </Text>
                  <Text style={{ fontSize: 8, color: '#6b7280', textAlign: 'center' }}>
                    {layout.signatureTitle}
                  </Text>
                </View>
              )
            }
            const raw =
              layer.type === 'title' && layout.titleLine
                ? layout.titleLine
                : layer.type === 'tagline' && layout.tagline
                  ? layout.tagline
                  : layer.text
            return (
              <Text
                key={layer.id}
                style={{
                  position: 'absolute',
                  left: sx(layer.x),
                  top: sy(layer.y),
                  width: sx(layer.w),
                  fontSize: Math.max(8, (layer.fontSize || 14) * 0.72),
                  color: layer.color || '#111827',
                  textAlign: layer.align || 'center',
                  fontFamily: fontFamily(layer),
                  opacity: layer.opacity ?? 1,
                }}
              >
                {resolve(raw, data) ||
                  (layer.type === 'recipient'
                    ? data.recipientName
                    : layer.type === 'course'
                      ? data.courseTitle
                      : layer.type === 'date'
                        ? data.issuedDate
                        : layer.type === 'verify'
                          ? data.verificationCode
                          : '')}
              </Text>
            )
          })}
          <Text
            style={{
              position: 'absolute',
              bottom: 10,
              left: 20,
              right: 20,
              fontSize: 7,
              color: '#9ca3af',
              textAlign: 'center',
            }}
          >
            Verify at {data.verifyUrl}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  return renderToBuffer(<CertificateDocument {...data} />)
}
