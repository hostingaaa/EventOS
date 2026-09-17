import type { CostItem, Event } from '../types';

export interface EventFinancials {
  /** Sum of all cost items in the event's default/most-common currency. */
  totalCost: number;
  /** Cost totals grouped by currency — the common case (one currency in use) has a single key. */
  totalsByCurrency: Record<string, number>;
  /** Parsed from `event.revenue`; null when no revenue has been entered yet. */
  revenue: number | null;
  /** revenue - totalCost across ALL currencies combined (no FX conversion) when revenue is set; null otherwise. */
  profit: number | null;
}

/**
 * Pure computed financial summary for an event, mirroring the computeEventHealth
 * pattern — derived from raw fields/cost items on read, never persisted.
 */
export function computeEventFinancials(event: Event, costItems: CostItem[] = []): EventFinancials {
  const totalsByCurrency: Record<string, number> = {};
  for (const item of costItems) {
    const currency = item.currency || 'USD';
    totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + item.total;
  }

  const totalCost = Object.values(totalsByCurrency).reduce((sum, n) => sum + n, 0);

  const revenueRaw = event.revenue?.trim();
  const revenue = revenueRaw ? parseFloat(revenueRaw) : null;
  const profit = revenue != null && !isNaN(revenue) ? revenue - totalCost : null;

  return { totalCost, totalsByCurrency, revenue, profit };
}
