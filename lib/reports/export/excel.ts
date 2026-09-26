import ExcelJS from 'exceljs'
import type { AiBriefPayload, ReportSnapshot } from '@/lib/reports/types'
import {
  buildReportOutline,
  outlineTable,
  partHasFacts,
  type OutlinePart,
} from '@/lib/reports/export/outline'

export async function buildExcelPack(
  snapshot: ReportSnapshot,
  brief?: AiBriefPayload | null
): Promise<Buffer> {
  const outline = buildReportOutline(snapshot, brief)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PelbuLMS'
  wb.created = new Date()

  const summary = wb.addWorksheet('Summary')
  summary.addRow([outline.title])
  summary.addRow(['Range', snapshot.range])
  summary.addRow(['Generated', snapshot.generatedAt])
  summary.addRow(['Audience', snapshot.audience])
  summary.addRow([])

  const pulse = outline.parts.find((part) => part.id === 'pulse')
  if (pulse?.metrics?.length) {
    summary.addRow(['KPI', 'Value', 'Hint', 'Link'])
    for (const metric of pulse.metrics) {
      summary.addRow([metric.label, metric.value, metric.hint || '', metric.href || ''])
    }
  }

  const usedSheets = new Set(wb.worksheets.map((sheet) => sheet.name))
  for (const part of outline.parts) {
    if (part.id === 'pulse' || !partHasFacts(part)) continue
    writePartSheet(wb, part, usedSheets)
  }

  if (outline.appendix.length) {
    const sheet = wb.addWorksheet(excelSheetName('AI Briefing', usedSheets))
    for (const part of outline.appendix) {
      writePartRows(sheet, part)
      sheet.addRow([])
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

function writePartSheet(wb: ExcelJS.Workbook, part: OutlinePart, used: Set<string>) {
  const sheet = wb.addWorksheet(excelSheetName(part.sheetTitle || part.title, used))
  writePartRows(sheet, part)
}

function writePartRows(sheet: ExcelJS.Worksheet, part: OutlinePart) {
  if (part.sectionTitle) sheet.addRow(['Section', part.sectionTitle])
  sheet.addRow([part.title])
  if (part.description) sheet.addRow(['Description', part.description])
  for (const paragraph of part.paragraphs || []) {
    sheet.addRow([paragraph])
  }
  if (part.sectionTitle || part.description || part.paragraphs?.length) sheet.addRow([])

  if (part.metrics?.length) {
    sheet.addRow(['Metric', 'Value', 'Hint', 'Link'])
    for (const metric of part.metrics) {
      sheet.addRow([metric.label, metric.value, metric.hint || '', metric.href || ''])
    }
    sheet.addRow([])
  }

  if (part.bars?.length) {
    sheet.addRow(['Step', 'Count'])
    for (const step of part.bars) {
      sheet.addRow([step.label, step.count])
    }
    sheet.addRow([])
  }

  const table = outlineTable(part)
  if (!table) return
  sheet.addRow(table.columns.map((column) => column.label))
  if (!table.rows.length) {
    sheet.addRow([part.emptyMessage || 'No rows.'])
    return
  }
  for (const row of table.rows) {
    sheet.addRow(table.columns.map((column) => row.cells[column.key] ?? ''))
  }
}

function excelSheetName(title: string, used: Set<string>) {
  const cleaned = title.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim()
  const base = (cleaned || 'Sheet').slice(0, 28)
  let name = base
  let n = 2
  while (used.has(name)) {
    const suffix = ` ${n}`
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`.slice(0, 31)
    n += 1
  }
  used.add(name)
  return name
}
