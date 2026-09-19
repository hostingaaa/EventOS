import type { ServiceReportCategoryState } from '../pages/ServiceReportPage';
import type { DesiredCostLine } from './generatorFinancialsSync';

/**
 * Maps the report's current line items into the shared generator sync
 * shape. `quantity` is the amount the team actually typed (least surprising
 * in the Financials table); the day multiplier is folded into `unitRate`
 * instead so `quantity * unitRate` still equals `day * amount * price`, and
 * is spelled out in the description when `day > 1` so it stays legible
 * without a schema change.
 */
export function buildServiceReportCostLines(
  categories: ServiceReportCategoryState[],
  currency: string,
): DesiredCostLine[] {
  const lines: DesiredCostLine[] = [];

  for (const cat of categories) {
    if (!cat.enabled) continue;
    for (const line of cat.lines) {
      const dayNote = line.day > 1 ? ` (${line.day} day(s) × ${line.price} ${currency}/day)` : '';
      lines.push({
        tag: `service-report:${line.id}`,
        category: cat.name,
        description: `${line.description || 'Service'}${dayNote}`,
        quantity: line.amount,
        unitRate: line.day * line.price,
      });
    }
  }

  return lines;
}
