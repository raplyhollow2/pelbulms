export type {
  ReportAudience,
  ReportBlock,
  ReportDefinition,
  ReportId,
  ReportMetric,
  ReportRow,
  ReportSectionId,
  ReportSectionPayload,
  ReportSnapshot,
  ReportRange,
  AiBriefPayload,
  SnapshotAudience,
  FrictionHotspot,
  FrictionMapPayload,
  FrictionType,
} from '@/lib/reports/types'

export {
  REPORT_CATALOG,
  REPORT_SECTIONS,
  reportsForSection,
  sectionsForAudiences,
} from '@/lib/reports/catalog'
export { INSTRUMENTATION_GAPS, instrumentationGapsAsReportRows } from '@/lib/reports/instrumentation-gaps'
export { rowsToCsv, downloadCsv } from '@/lib/reports/csv'
export { buildReportSnapshot } from '@/lib/reports/compute-executive'
export { resolveSnapshotForUser } from '@/lib/reports/resolve-snapshot'
export { audienceAllowsAiBrief } from '@/lib/reports/types'
