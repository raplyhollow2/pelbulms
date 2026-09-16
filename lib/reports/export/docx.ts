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
import type { AiBriefPayload, ReportSnapshot } from '@/lib/reports/types'

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

function simpleTable(headers: string[], rows: (string | number)[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headers.map(
          (h) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: h, bold: true })],
                }),
              ],
            })
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: String(cell ?? '') })],
                    }),
                  ],
                })
            ),
          })
      ),
    ],
  })
}

export async function buildDocxPack(
  snapshot: ReportSnapshot,
  brief?: AiBriefPayload | null
): Promise<Buffer> {
  const blocks: (Paragraph | Table)[] = [
    para('PelbuLMS Executive Report', { heading: HeadingLevel.TITLE }),
    para(
      `Range: ${snapshot.range} · Generated: ${new Date(snapshot.generatedAt).toLocaleString()} · Audience: ${snapshot.audience}`
    ),
  ]

  if (brief) {
    blocks.push(para('Executive summary', { heading: HeadingLevel.HEADING_1 }))
    blocks.push(para(brief.headline, { bold: true }))
    blocks.push(para(brief.summary))
    blocks.push(para('Priorities', { heading: HeadingLevel.HEADING_2 }))
    for (const pr of brief.priorities) {
      blocks.push(para(`[${pr.severity}] ${pr.title}`, { bold: true }))
      blocks.push(para(pr.rationale))
      blocks.push(para(`Suggested: ${pr.suggestedAction}`))
    }
  }

  blocks.push(para('Key metrics', { heading: HeadingLevel.HEADING_1 }))
  for (const k of snapshot.kpis) {
    blocks.push(para(`${k.label}: ${k.value}`))
  }

  blocks.push(para('Growth funnel', { heading: HeadingLevel.HEADING_1 }))
  for (const f of snapshot.funnel) {
    blocks.push(para(`${f.label}: ${f.count}`))
  }

  blocks.push(para('Recommended actions', { heading: HeadingLevel.HEADING_1 }))
  for (const a of snapshot.actions) {
    blocks.push(para(`${a.priority}. ${a.title} — ${a.reason}`))
  }

  blocks.push(para('Alerts', { heading: HeadingLevel.HEADING_1 }))
  if (!snapshot.alerts.length) {
    blocks.push(para('No alerts in this window.'))
  } else {
    for (const a of snapshot.alerts) {
      blocks.push(para(`[${a.severity}] ${a.title}: ${a.detail}`))
    }
  }

  blocks.push(para('Institution scoreboard', { heading: HeadingLevel.HEADING_1 }))
  blocks.push(
    simpleTable(
      ['Institution', 'Score', 'Active %', 'Completion %', 'Enrollments'],
      snapshot.institutionScores.slice(0, 25).map((s) => [
        s.name,
        s.compositeScore,
        s.activeRate,
        s.completionRate,
        s.enrollments,
      ])
    )
  )

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: blocks,
      },
    ],
  })

  return Buffer.from(await Packer.toBuffer(doc))
}
