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

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1f2937' },
  title: { fontSize: 22, marginBottom: 6, color: '#c2410c' },
  subtitle: { fontSize: 11, color: '#6b7280', marginBottom: 18 },
  h2: { fontSize: 14, marginTop: 14, marginBottom: 8, color: '#111827' },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  kpi: {
    width: '23%',
    padding: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 4,
    marginBottom: 6,
  },
  kpiLabel: { fontSize: 8, color: '#9a3412', marginBottom: 4 },
  kpiValue: { fontSize: 14, fontWeight: 700 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', paddingVertical: 4 },
  cell: { flex: 1, fontSize: 9 },
  alert: { marginBottom: 6, padding: 8, backgroundColor: '#fef2f2', borderRadius: 4 },
  muted: { color: '#6b7280', fontSize: 9 },
})

function FunnelBars({ snapshot }: { snapshot: ReportSnapshot }) {
  const max = Math.max(...snapshot.funnel.map((f) => f.count), 1)
  return (
    <View>
      {snapshot.funnel.map((f) => {
        const w = Math.max(8, Math.round((f.count / max) * 400))
        return (
          <View key={f.key} style={{ marginBottom: 6 }}>
            <Text style={{ marginBottom: 2 }}>
              {f.label}: {f.count}
            </Text>
            <Svg width={420} height={10}>
              <Rect x={0} y={0} width={420} height={10} fill="#ffedd5" />
              <Rect x={0} y={0} width={w} height={10} fill="#ea580c" />
            </Svg>
          </View>
        )
      })}
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
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>PelbuLMS Executive Command Report</Text>
        <Text style={styles.subtitle}>
          Range {snapshot.range} · {new Date(snapshot.generatedAt).toLocaleString()} ·{' '}
          {snapshot.audience}
        </Text>

        <Text style={styles.h2}>Today&apos;s pulse</Text>
        <View style={styles.kpiRow}>
          {snapshot.kpis.slice(0, 8).map((k) => (
            <View key={k.key} style={styles.kpi}>
              <Text style={styles.kpiLabel}>{k.label}</Text>
              <Text style={styles.kpiValue}>{String(k.value)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>Growth funnel</Text>
        <FunnelBars snapshot={snapshot} />

        {brief ? (
          <View>
            <Text style={styles.h2}>AI decision briefing</Text>
            <Text style={{ fontWeight: 700, marginBottom: 4 }}>{brief.headline}</Text>
            <Text style={{ marginBottom: 8 }}>{brief.summary}</Text>
            {brief.priorities.map((p, i) => (
              <Text key={i} style={{ marginBottom: 4 }}>
                [{p.severity}] {p.title} — {p.suggestedAction}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.h2}>Action queue</Text>
        {snapshot.actions.map((a) => (
          <Text key={a.id} style={{ marginBottom: 3 }}>
            {a.priority}. {a.title} ({a.reason})
          </Text>
        ))}
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Institution scoreboard</Text>
        <View style={styles.row}>
          <Text style={[styles.cell, { flex: 2 }]}>Institution</Text>
          <Text style={styles.cell}>Score</Text>
          <Text style={styles.cell}>Active%</Text>
          <Text style={styles.cell}>Compl%</Text>
          <Text style={styles.cell}>Enrolls</Text>
        </View>
        {snapshot.institutionScores.slice(0, 30).map((s) => (
          <View key={s.id} style={styles.row}>
            <Text style={[styles.cell, { flex: 2 }]}>{s.name}</Text>
            <Text style={styles.cell}>{s.compositeScore}</Text>
            <Text style={styles.cell}>{s.activeRate}</Text>
            <Text style={styles.cell}>{s.completionRate}</Text>
            <Text style={styles.cell}>{s.enrollments}</Text>
          </View>
        ))}

        <Text style={styles.h2}>Alerts</Text>
        {snapshot.alerts.length === 0 ? (
          <Text style={styles.muted}>No alerts in this window.</Text>
        ) : (
          snapshot.alerts.map((a) => (
            <View key={a.id} style={styles.alert}>
              <Text>
                [{a.severity}] {a.title}
              </Text>
              <Text style={styles.muted}>{a.detail}</Text>
            </View>
          ))
        )}
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
