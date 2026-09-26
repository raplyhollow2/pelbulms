import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Svg,
  Rect,
} from '@react-pdf/renderer'
import type { AiBriefPayload, ReportSnapshot } from '@/lib/reports/types'
import {
  buildReportOutline,
  outlineCellText,
  outlineTable,
  type OutlinePart,
} from '@/lib/reports/export/outline'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1f2937' },
  title: { fontSize: 22, marginBottom: 6, color: '#c2410c' },
  subtitle: { fontSize: 11, color: '#6b7280', marginBottom: 16 },
  h1: { fontSize: 14, marginTop: 14, marginBottom: 6, color: '#111827' },
  h2: { fontSize: 12, marginTop: 10, marginBottom: 4, color: '#111827' },
  description: { fontSize: 9, color: '#6b7280', marginBottom: 6 },
  paragraph: { fontSize: 10, marginBottom: 4 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  kpi: {
    width: '23%',
    padding: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  kpiLabel: { fontSize: 8, color: '#9a3412', marginBottom: 4 },
  kpiValue: { fontSize: 14, fontWeight: 700 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingVertical: 4,
    backgroundColor: '#f9fafb',
  },
  cell: { flex: 1, fontSize: 8, paddingRight: 4 },
  cellWide: { flex: 1.6, fontSize: 8, paddingRight: 4 },
  muted: { color: '#6b7280', fontSize: 9, marginBottom: 4 },
  metricLine: { fontSize: 9, marginBottom: 2 },
})

/**
 * Standard PDF fonts are WinAnsi. Characters such as ≥ otherwise render as a
 * stray letter, so export text is normalized before it is drawn.
 */
export function pdfText(value: unknown): string {
  const mapped = outlineCellText(value)
    .replaceAll('\u2265', '>=')
    .replaceAll('\u2264', '<=')
    .replaceAll('\u226B', '>>')
    .replaceAll('\u2014', '-')
    .replaceAll('\u2013', '-')
    .replaceAll('\u2018', "'")
    .replaceAll('\u2019', "'")
    .replaceAll('\u201C', '"')
    .replaceAll('\u201D', '"')
    .replaceAll('\u2026', '...')
    .replaceAll('\u2192', '->')
    .replaceAll('\u2212', '-')
    .replaceAll('\u00A0', ' ')
  return mapped.replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, '')
}

function Heading({ part }: { part: OutlinePart }) {
  return (
    <View>
      <Text style={part.level === 1 ? styles.h1 : styles.h2} minPresenceAhead={48}>
        {pdfText(part.title)}
      </Text>
      {part.description ? <Text style={styles.description}>{pdfText(part.description)}</Text> : null}
    </View>
  )
}

function Pulse({ part }: { part: OutlinePart }) {
  return (
    <View style={styles.kpiRow}>
      {(part.metrics || []).map((metric) => (
        <View key={metric.key} style={styles.kpi} wrap={false}>
          <Text style={styles.kpiLabel}>{pdfText(metric.label)}</Text>
          <Text style={styles.kpiValue}>{pdfText(metric.value)}</Text>
          {metric.hint ? <Text style={styles.muted}>{pdfText(metric.hint)}</Text> : null}
        </View>
      ))}
    </View>
  )
}

function MetricLines({ part }: { part: OutlinePart }) {
  if (!part.metrics?.length || part.id === 'pulse') return null
  return (
    <View style={{ marginBottom: 4 }}>
      {part.metrics.map((metric) => (
        <Text key={metric.key} style={styles.metricLine}>
          {pdfText(metric.label)}: {pdfText(metric.value)}
          {metric.hint ? ` (${pdfText(metric.hint)})` : ''}
        </Text>
      ))}
    </View>
  )
}

function Bars({ part }: { part: OutlinePart }) {
  const steps = part.bars || []
  if (!steps.length) return null
  const max = Math.max(...steps.map((step) => step.count), 1)
  return (
    <View style={{ marginBottom: 6 }}>
      {steps.map((step) => {
        const width = Math.max(8, Math.round((step.count / max) * 400))
        return (
          <View key={step.key} style={{ marginBottom: 6 }} wrap={false}>
            <Text style={{ marginBottom: 2 }}>
              {pdfText(step.label)}: {pdfText(step.count)}
            </Text>
            <Svg width={420} height={10}>
              <Rect x={0} y={0} width={420} height={10} fill="#ffedd5" />
              <Rect x={0} y={0} width={width} height={10} fill="#ea580c" />
            </Svg>
          </View>
        )
      })}
    </View>
  )
}

function TableBlock({ part }: { part: OutlinePart }) {
  const table = outlineTable(part)
  if (!table) return null
  if (!table.rows.length) {
    return <Text style={styles.muted}>{pdfText(part.emptyMessage || 'No rows.')}</Text>
  }
  const wide = table.columns.length > 6
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={styles.headerRow} wrap={false}>
        {table.columns.map((column, index) => (
          <Text
            key={column.key}
            style={[
              index === 0 ? styles.cellWide : styles.cell,
              { fontSize: wide ? 7 : 8 },
            ]}
          >
            {pdfText(column.label)}
          </Text>
        ))}
      </View>
      {table.rows.map((row) => (
        <View key={row.id} style={styles.row} wrap={false}>
          {table.columns.map((column, index) => (
            <Text
              key={column.key}
              style={[
                index === 0 ? styles.cellWide : styles.cell,
                { fontSize: wide ? 7 : 8 },
              ]}
            >
              {pdfText(row.cells[column.key])}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function PartView({ part }: { part: OutlinePart }) {
  return (
    <View>
      <Heading part={part} />
      {(part.paragraphs || []).map((paragraph, index) => (
        <Text key={index} style={styles.paragraph}>
          {pdfText(paragraph)}
        </Text>
      ))}
      {part.id === 'pulse' ? <Pulse part={part} /> : <MetricLines part={part} />}
      <Bars part={part} />
      <TableBlock part={part} />
    </View>
  )
}

function ReportPdfDocument({
  snapshot,
  brief,
}: {
  snapshot: ReportSnapshot
  brief?: AiBriefPayload | null
}) {
  const outline = buildReportOutline(snapshot, brief)
  const parts = [...outline.parts, ...outline.appendix]
  return (
    <Document title={pdfText(outline.title)} author="PelbuLMS">
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>{pdfText(outline.title)}</Text>
        <Text style={styles.subtitle}>{pdfText(outline.subtitle)}</Text>
        {parts.map((part) => (
          <PartView key={part.id} part={part} />
        ))}
      </Page>
    </Document>
  )
}

export async function buildPdfPack(
  snapshot: ReportSnapshot,
  brief?: AiBriefPayload | null
): Promise<Buffer> {
  const buf = await renderToBuffer(
    <ReportPdfDocument snapshot={snapshot} brief={brief} />
  )
  return Buffer.from(buf)
}
