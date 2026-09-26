import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { AiBriefPayload, ReportSnapshot, SnapshotAudience } from '@/lib/reports/types'
import {
  buildReportOutline,
  outlineCellText,
  outlineTable,
  type OutlinePart,
} from '@/lib/reports/export/outline'

function para(
  text: string,
  opts?: { bold?: boolean; heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel] }
) {
  return new Paragraph({
    heading: opts?.heading,
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text, bold: opts?.bold })],
    spacing: { after: 120 },
  })
}

function simpleTable(headers: string[], rows: string[][]) {
  const width = headers.length > 0 ? Math.floor(100 / headers.length) : 100
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map(
          (header) =>
            new TableCell({
              width: { size: width, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: header, bold: true })],
                }),
              ],
            })
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: headers.map(
              (_, index) =>
                new TableCell({
                  width: { size: width, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: row[index] ?? '' })],
                    }),
                  ],
                })
            ),
          })
      ),
    ],
  })
}

function headingFor(part: OutlinePart) {
  if (part.id === 'detailed-reports' || part.level === 1) return HeadingLevel.HEADING_1
  return HeadingLevel.HEADING_2
}

export function wordBriefTitle(audience: SnapshotAudience): string {
  switch (audience) {
    case 'instructor':
      return 'Course and learner brief'
    case 'admin':
      return 'Institution operations brief'
    case 'superadmin':
      return 'Platform command brief'
    case 'resource_person':
      return 'Approvals and activation brief'
    default:
      return 'Pelbu report'
  }
}

function renderNarrative(brief: AiBriefPayload, parts: OutlinePart[]) {
  const blocks: (Paragraph | Table)[] = []
  const used = new Set<string>()
  const byId = new Map(parts.map((part) => [part.id, part]))

  if (brief.sections?.length) {
    blocks.push(para('Figures in this reading', { heading: HeadingLevel.HEADING_1 }))
    for (const section of brief.sections) {
      blocks.push(para(`${section.figure}: ${section.value}`, { bold: true }))
      blocks.push(para(section.reading))
    }
  }

  for (const block of brief.narrative || []) {
    blocks.push(para(block.heading, { heading: HeadingLevel.HEADING_1 }))
    if (block.severity && block.severity !== 'note') {
      blocks.push(para(block.severity.toUpperCase(), { bold: true }))
    }
    for (const paragraph of block.paragraphs) blocks.push(para(paragraph))
    const part = block.tableKey ? byId.get(block.tableKey) : undefined
    if (part && !used.has(part.id)) {
      used.add(part.id)
      blocks.push(...renderPart(part).slice(1))
    }
  }

  if (brief.priorities?.length) {
    blocks.push(para('Priorities', { heading: HeadingLevel.HEADING_1 }))
    for (const priority of brief.priorities) {
      blocks.push(para(`[${priority.severity}] ${priority.title}`, { bold: true }))
      blocks.push(para(priority.rationale))
      blocks.push(para(`Suggested: ${priority.suggestedAction}`))
    }
  }

  if (brief.caveat) {
    blocks.push(para('What this does not show', { heading: HeadingLevel.HEADING_2 }))
    blocks.push(para(brief.caveat))
  }

  if (brief.questionsForTeam?.length) {
    blocks.push(para('Questions for the team', { heading: HeadingLevel.HEADING_2 }))
    for (const question of brief.questionsForTeam) blocks.push(para(question))
  }

  return { blocks, used }
}

function renderPart(part: OutlinePart): (Paragraph | Table)[] {
  const blocks: (Paragraph | Table)[] = [para(part.title, { heading: headingFor(part) })]
  if (part.description) blocks.push(para(part.description))
  for (const paragraph of part.paragraphs || []) {
    blocks.push(para(paragraph, { bold: part.id === 'ai-brief' && paragraph === part.paragraphs?.[0] }))
  }

  if (part.metrics?.length) {
    blocks.push(
      simpleTable(
        ['Metric', 'Value', 'Hint'],
        part.metrics.map((metric) => [
          metric.label,
          outlineCellText(metric.value),
          metric.hint || '',
        ])
      )
    )
  }

  if (part.bars?.length) {
    blocks.push(
      simpleTable(
        ['Step', 'Count'],
        part.bars.map((step) => [step.label, outlineCellText(step.count)])
      )
    )
  }

  const table = outlineTable(part)
  if (table) {
    if (!table.rows.length) {
      blocks.push(para(part.emptyMessage || 'No rows.'))
    } else {
      blocks.push(
        simpleTable(
          table.columns.map((column) => column.label),
          table.rows.map((row) =>
            table.columns.map((column) => outlineCellText(row.cells[column.key]))
          )
        )
      )
    }
  }

  return blocks
}

export async function buildDocxPack(
  snapshot: ReportSnapshot,
  brief?: AiBriefPayload | null
): Promise<Buffer> {
  const outline = buildReportOutline(snapshot, brief)
  const narrative = brief?.narrative?.length || brief?.sections?.length ? renderNarrative(brief, outline.parts) : null
  const children: (Paragraph | Table)[] = [
    para(narrative ? wordBriefTitle(snapshot.audience) : outline.title, { heading: HeadingLevel.TITLE }),
    para(outline.subtitle),
  ]

  if (narrative) {
    children.push(...narrative.blocks)
    for (const part of outline.parts) {
      if (narrative.used.has(part.id)) continue
      children.push(...renderPart(part))
    }
    children.push(
      para(
        `Figures are from PelbuLMS. Interpretation was drafted by ${brief?.model || 'the selected model'} on ${new Date(brief?.generatedAt || snapshot.generatedAt).toLocaleString()} and should be checked against the tables.`
      )
    )
  } else {
    for (const part of [...outline.parts, ...outline.appendix]) {
      children.push(...renderPart(part))
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })

  return Buffer.from(await Packer.toBuffer(doc))
}
