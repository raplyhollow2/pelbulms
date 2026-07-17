import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'

export interface CertificateData {
  recipientName: string
  courseTitle: string
  issuedDate: string
  verificationCode: string
  verifyUrl: string
  instructorName?: string
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  border: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E9B308',
    borderStyle: 'solid',
    padding: 24,
  },
  innerBorder: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'solid',
    paddingVertical: 36,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    fontSize: 14,
    letterSpacing: 3,
    color: '#E9B308',
    fontFamily: 'Helvetica-Bold',
  },
  title: {
    fontSize: 34,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginTop: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center',
  },
  presentedTo: {
    fontSize: 11,
    color: '#6b7280',
    letterSpacing: 2,
    marginTop: 18,
  },
  name: {
    fontSize: 30,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginTop: 8,
    textAlign: 'center',
  },
  nameRule: {
    marginTop: 8,
    width: 320,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  bodyText: {
    fontSize: 12,
    color: '#374151',
    marginTop: 18,
    textAlign: 'center',
  },
  courseTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginTop: 8,
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 28,
  },
  footerBlock: {
    alignItems: 'center',
    maxWidth: 200,
  },
  footerLabel: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 4,
  },
  footerValue: {
    fontSize: 11,
    color: '#111827',
    fontFamily: 'Helvetica-Bold',
  },
  verifyText: {
    fontSize: 8,
    color: '#9ca3af',
    marginTop: 18,
    textAlign: 'center',
  },
})

function CertificateDocument(data: CertificateData) {
  return (
    <Document
      title={`Certificate - ${data.courseTitle}`}
      author="Pelbu LMS"
      subject={`Certificate of Completion for ${data.recipientName}`}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border}>
          <View style={styles.innerBorder}>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.brand}>PELBU LMS</Text>
              <Text style={styles.title}>Certificate of Completion</Text>
              <Text style={styles.subtitle}>This is proudly presented to</Text>
            </View>

            <View style={{ alignItems: 'center' }}>
              <Text style={styles.name}>{data.recipientName}</Text>
              <View style={styles.nameRule} />
              <Text style={styles.bodyText}>for successfully completing the course</Text>
              <Text style={styles.courseTitle}>{data.courseTitle}</Text>
            </View>

            <View style={{ width: '100%' }}>
              <View style={styles.footerRow}>
                <View style={styles.footerBlock}>
                  <Text style={styles.footerValue}>{data.issuedDate}</Text>
                  <Text style={styles.footerLabel}>Date Issued</Text>
                </View>
                <View style={styles.footerBlock}>
                  <Text style={styles.footerValue}>{data.instructorName || 'Pelbu LMS'}</Text>
                  <Text style={styles.footerLabel}>Instructor</Text>
                </View>
                <View style={styles.footerBlock}>
                  <Text style={styles.footerValue}>{data.verificationCode}</Text>
                  <Text style={styles.footerLabel}>Verification Code</Text>
                </View>
              </View>
              <Text style={styles.verifyText}>
                Verify this certificate at {data.verifyUrl}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  return renderToBuffer(<CertificateDocument {...data} />)
}
