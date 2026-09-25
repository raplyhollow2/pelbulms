import ExcelJS from 'exceljs'
import type { AiBriefPayload, ReportSnapshot } from '@/lib/reports/types'

export async function buildExcelPack(
  snapshot: ReportSnapshot,
  brief?: AiBriefPayload | null
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PelbuLMS'
  wb.created = new Date()

  const summary = wb.addWorksheet('Summary KPIs')
  summary.addRow(['PelbuLMS Executive Report Pack'])
  summary.addRow(['Range', snapshot.range])
  summary.addRow(['Generated', snapshot.generatedAt])
  summary.addRow(['Audience', snapshot.audience])
  summary.addRow([])
  summary.addRow(['KPI', 'Value', 'Hint', 'Link'])
  for (const k of snapshot.kpis) {
    summary.addRow([k.label, k.value, k.hint || '', k.href || ''])
  }

  const funnel = wb.addWorksheet('Funnel')
  funnel.addRow(['Step', 'Count'])
  for (const s of snapshot.funnel) {
    funnel.addRow([s.label, s.count])
  }

  const inst = wb.addWorksheet('Institutions')
  inst.addRow([
    'Institution',
    'Members',
    'Enrollments',
    'Active %',
    'Completion %',
    'Median KYC (h)',
    'Score',
  ])
  for (const s of snapshot.institutionScores) {
    inst.addRow([
      s.name,
      s.members,
      s.enrollments,
      s.activeRate,
      s.completionRate,
      s.medianApprovalHours ?? '',
      s.compositeScore,
    ])
  }

  const alerts = wb.addWorksheet('Alerts')
  alerts.addRow(['Severity', 'Title', 'Detail', 'Link'])
  for (const a of snapshot.alerts) {
    alerts.addRow([a.severity, a.title, a.detail, a.href || ''])
  }

  const actions = wb.addWorksheet('Actions')
  actions.addRow(['Priority', 'Title', 'Reason', 'Link'])
  for (const a of snapshot.actions) {
    actions.addRow([a.priority, a.title, a.reason, a.href])
  }

  for (const table of snapshot.tables) {
    const linkable = table.rows.some((row) => row.href)
    const ws = wb.addWorksheet(table.title.slice(0, 28))
    ws.addRow([...table.columns.map((c) => c.label), ...(linkable ? ['Link'] : [])])
    for (const row of table.rows) {
      ws.addRow([
        ...table.columns.map((c) => row.cells[c.key] ?? ''),
        ...(linkable ? [row.href || ''] : []),
      ])
    }
  }

  if (brief) {
    const ai = wb.addWorksheet('AI Briefing')
    ai.addRow(['Headline', brief.headline])
    ai.addRow(['Summary', brief.summary])
    ai.addRow([])
    ai.addRow(['Severity', 'Title', 'Rationale', 'Suggested action'])
    for (const p of brief.priorities) {
      ai.addRow([p.severity, p.title, p.rationale, p.suggestedAction])
    }
    ai.addRow([])
    ai.addRow(['Questions for team'])
    for (const q of brief.questionsForTeam) {
      ai.addRow([q])
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
