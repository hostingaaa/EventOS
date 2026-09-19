/**
 * The fixed set of cost categories used by the Service Report generator —
 * distinct from `categories.ts`'s `OPS_CATEGORIES` (task tagging). Not every
 * program uses every category; the generator lets a team member check off
 * only the ones that applied.
 */
export const SERVICE_REPORT_CATEGORIES = [
  'Labor',
  'Conference Equipment',
  'Catering',
  'Conference Supplies and Materials',
  'Printing and Duplication',
  'Photography',
  'Airport transfers and Ground Transportation',
  'Funds Distribution',
] as const;

export type ServiceReportCategory = (typeof SERVICE_REPORT_CATEGORIES)[number];
