import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'
import {
  defaultCertificateLayout,
  layoutFromLegacySettings,
  type CertificateLayout,
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

function resolve(text: string | undefined, data: CertificateData) {
  return (text || '')
    .replace('{{recipient}}', data.recipientName)
    .replace('{{course}}', data.courseTitle)
    .replace('{{date}}', data.issuedDate)
    .replace('{{code}}', data.verificationCode)
}

function CertificateDocument(data: CertificateData) {
  const layout = data.design?.layout
    ? defaultCertificateLayout(data.design.layout)
    : layoutFromLegacySettings(data.design as any)
  const accent = layout.accentColor || '#E9B308'
  const borderW =
    layout.borderStyle === 'none' ? 0 : layout.borderStyle === 'ornate' ? 8 : layout.borderStyle === 'double' ? 4 : 3

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

  return (
    <Document title={`Certificate - ${data.courseTitle}`} author={layout.brandName}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          {layout.logos.map((logo) =>
            logo.src ? (
              <Image
                key={logo.id}
                src={logo.src}
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
          {layout.layers.map((layer) => {
            if (layer.type === 'signature' && layout.signatureUrl) {
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
                  }}
                >
                  <Image
                    src={layout.signatureUrl}
                    style={{ height: sy(50), objectFit: 'contain' }}
                  />
                  <Text style={{ fontSize: 9, marginTop: 4, textAlign: 'center' }}>
                    {layout.signatureName || data.instructorName}
                  </Text>
                  <Text style={{ fontSize: 8, color: '#6b7280' }}>{layout.signatureTitle}</Text>
                </View>
              )
            }
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
                  fontFamily:
                    layer.type === 'title' || layer.type === 'recipient'
                      ? 'Helvetica-Bold'
                      : 'Helvetica',
                }}
              >
                {resolve(layer.text, data) ||
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
