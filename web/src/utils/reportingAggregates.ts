import type { CostItem, Event } from '../types';
import { parseIsoDate } from './calendarDates';
import { computeEventFinancials } from './financials';
import { getMemberByEmail } from './roleStore';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export interface MonthlyTrendPoint {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
}

export interface BreakdownEntry {
  key: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
}

/** Groups cost items by eventCode once, reused by every breakdown below. */
export function groupCostItemsByEvent(costItems: CostItem[]): Record<string, CostItem[]> {
  const map: Record<string, CostItem[]> = {};
  for (const item of costItems) {
    (map[item.eventCode] ??= []).push(item);
  }
  return map;
}

export function yearsInUse(events: Event[]): number[] {
  const years = new Set<number>();
  for (const ev of events) {
    const d = parseIsoDate(ev.startDate);
    if (d) years.add(d.getFullYear());
  }
  if (years.size === 0) years.add(new Date().getFullYear());
  return Array.from(years).sort((a, b) => b - a);
}

export function filterEventsByYear(events: Event[], year: number): Event[] {
  return events.filter((ev) => {
    const d = parseIsoDate(ev.startDate);
    return d != null && d.getFullYear() === year;
  });
}

export function computeMonthlyTrend(
  events: Event[],
  costItemsByEvent: Record<string, CostItem[]>,
  year: number,
): MonthlyTrendPoint[] {
  const points: MonthlyTrendPoint[] = MONTH_LABELS.map((month) => ({ month, revenue: 0, cost: 0, profit: 0 }));

  for (const ev of events) {
    const d = parseIsoDate(ev.startDate);
    if (!d || d.getFullYear() !== year) continue;
    const financials = computeEventFinancials(ev, costItemsByEvent[ev.code] ?? []);
    const point = points[d.getMonth()];
    point.revenue += financials.revenue ?? 0;
    point.cost += financials.totalCost;
    point.profit += (financials.revenue ?? 0) - financials.totalCost;
  }

  return points;
}

export function computeCategoryBreakdown(costItems: CostItem[]): { category: string; total: number }[] {
  const totals: Record<string, number> = {};
  for (const item of costItems) {
    totals[item.category || 'General'] = (totals[item.category || 'General'] || 0) + item.total;
  }
  return Object.entries(totals)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

function ownerDisplayName(email: string): string {
  if (!email) return 'Unassigned';
  return getMemberByEmail(email)?.name || email;
}

export function computeOwnerBreakdown(
  events: Event[],
  costItemsByEvent: Record<string, CostItem[]>,
): BreakdownEntry[] {
  const byOwner: Record<string, BreakdownEntry> = {};
  for (const ev of events) {
    const key = ev.ownerEmail || 'unassigned';
    const financials = computeEventFinancials(ev, costItemsByEvent[ev.code] ?? []);
    const entry = (byOwner[key] ??= { key, label: ownerDisplayName(ev.ownerEmail), revenue: 0, cost: 0, profit: 0 });
    entry.revenue += financials.revenue ?? 0;
    entry.cost += financials.totalCost;
    entry.profit += (financials.revenue ?? 0) - financials.totalCost;
  }
  return Object.values(byOwner).sort((a, b) => b.cost - a.cost);
}

/** Country parsed as the text after the last comma in `location` (falls back to the full string, e.g. "Tunis"). */
function countryFromLocation(location: string): string {
  const trimmed = (location || '').trim();
  if (!trimmed) return 'Unknown';
  const idx = trimmed.lastIndexOf(',');
  return idx === -1 ? trimmed : trimmed.slice(idx + 1).trim();
}

export function computeCountryBreakdown(
  events: Event[],
  costItemsByEvent: Record<string, CostItem[]>,
): BreakdownEntry[] {
  const byCountry: Record<string, BreakdownEntry> = {};
  for (const ev of events) {
    const country = countryFromLocation(ev.location);
    const financials = computeEventFinancials(ev, costItemsByEvent[ev.code] ?? []);
    const entry = (byCountry[country] ??= { key: country, label: country, revenue: 0, cost: 0, profit: 0 });
    entry.revenue += financials.revenue ?? 0;
    entry.cost += financials.totalCost;
    entry.profit += (financials.revenue ?? 0) - financials.totalCost;
  }
  return Object.values(byCountry).sort((a, b) => b.cost - a.cost);
}
