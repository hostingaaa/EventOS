/** Aggregation behind the Reports page: periods, KPIs, chart buckets, country / cost / owner breakdowns, P&L rows. */
import type { ReportRow } from '../types';
import { cityOfLocation, countryOfLocation } from './countries';

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Margins under this are flagged as low in the table. */
export const LOW_MARGIN = 0.25;

// ─── Periods ───────────────────────────────────────────────────────────────

export type PeriodId = 'q1' | 'q2' | 'q3' | 'q4' | 'ytd' | 'fy';

export interface PeriodOption {
  id: PeriodId;
  label: string;
  /** Month indexes (0–11) the period covers. */
  months: number[];
  caption: string;
}

function monthsOf(from: number, to: number): number[] {
  const out: number[] = [];
  for (let m = from; m <= to; m++) out.push(m);
  return out;
}

/**
 * The period switcher's options. For the current year: the previous quarter (if there is one), the current
 * quarter, year-to-date and the full year. For any other year: all four quarters and the full year.
 */
export function periodOptions(year: number, today: Date): PeriodOption[] {
  const thisYear = today.getFullYear();
  const thisMonth = today.getMonth();
  const quarter = (q: number): PeriodOption => {
    const from = (q - 1) * 3;
    const months = monthsOf(from, from + 2);
    const reachesFuture = year > thisYear || (year === thisYear && from + 2 >= thisMonth);
    return {
      id: `q${q}` as PeriodId,
      label: `Q${q}`,
      months,
      caption: `Q${q} ${year} · ${MONTH_LABELS[from]} – ${MONTH_LABELS[from + 2]}${reachesFuture ? ', includes booked events' : ''}`,
    };
  };
  const full: PeriodOption = {
    id: 'fy',
    label: `FY ${year}`,
    months: monthsOf(0, 11),
    caption: `Full year ${year}, delivered + booked`,
  };

  if (year !== thisYear) return [quarter(1), quarter(2), quarter(3), quarter(4), full];

  const current = Math.floor(thisMonth / 3) + 1;
  const ytd: PeriodOption = {
    id: 'ytd',
    label: 'YTD',
    months: monthsOf(0, thisMonth),
    caption: `Year to date · Jan – ${MONTH_LABELS[thisMonth]} ${year}`,
  };
  return [...(current > 1 ? [quarter(current - 1)] : []), quarter(current), ytd, full];
}

export function defaultPeriod(year: number, today: Date): PeriodId {
  return year === today.getFullYear() ? 'ytd' : 'fy';
}

/** How many of a period's months have fully passed — what a monthly target applies to. */
export function elapsedMonths(months: number[], year: number, today: Date): number {
  if (year < today.getFullYear()) return months.length;
  if (year > today.getFullYear()) return 0;
  return months.filter((m) => m < today.getMonth()).length;
}

// ─── Events ────────────────────────────────────────────────────────────────

export type PaymentLabel = 'Paid' | 'Invoiced' | 'Booked';

export interface ReportEvent {
  code: string;
  city: string;
  country: string;
  /** Month index (0–11) of the event's end date, which is when its revenue is recognised. */
  month: number;
  endDate: string;
  owner: string;
  ownerEmail: string;
  revenue: number;
  cost: number;
  profit: number;
  /** null when there is no contract value to take a margin of. */
  margin: number | null;
  costByCategory: Record<string, number>;
  paid: boolean;
  /** True until the event's end date has passed. */
  booked: boolean;
  status: PaymentLabel;
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function prepareEvents(rows: ReportRow[], today: Date, ownerName: (email: string) => string): ReportEvent[] {
  const todayIso = isoDay(today);
  return rows
    .filter((r) => r.endDate)
    .map((r) => {
      const booked = r.endDate >= todayIso;
      const profit = r.revenue - r.cost;
      return {
        code: r.code,
        city: cityOfLocation(r.location),
        country: countryOfLocation(r.location),
        month: parseInt(r.endDate.slice(5, 7), 10) - 1,
        endDate: r.endDate,
        owner: ownerName(r.ownerEmail),
        ownerEmail: r.ownerEmail,
        revenue: r.revenue,
        cost: r.cost,
        profit,
        margin: r.revenue > 0 ? profit / r.revenue : null,
        costByCategory: r.costByCategory,
        paid: r.paid,
        booked,
        status: booked ? 'Booked' : r.paid ? 'Paid' : 'Invoiced',
      } satisfies ReportEvent;
    });
}

// ─── Formatting ────────────────────────────────────────────────────────────

/** Compact money for cards and charts: $1.24M, $84.2k, $950. */
export function moneyShort(v: number): string {
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}k`;
  return `${sign}$${Math.round(a)}`;
}

/** Full money for the table: $84,200. */
export function moneyFull(v: number): string {
  return `${v < 0 ? '-' : ''}$${Math.round(Math.abs(v)).toLocaleString('en-US')}`;
}

/** Margin of `revenue` over `cost` as "38%", or an em dash when there is no revenue. */
export function marginText(revenue: number, cost: number): string {
  return revenue > 0 ? `${Math.round(((revenue - cost) / revenue) * 100)}%` : '—';
}

// ─── The report ────────────────────────────────────────────────────────────

export type SortKey = 'code' | 'month' | 'revenue' | 'profit' | 'margin';

export interface Kpis {
  revenue: number;
  bookedRevenue: number;
  cost: number;
  profit: number;
  deliveredCount: number;
  bookedCount: number;
  receivables: number;
  unpaidCount: number;
  oldestUnpaid: string | null;
  /** Monthly target × elapsed months in the period; 0 when no target is set. */
  target: number;
}

export interface MonthBar {
  month: number;
  label: string;
  inPeriod: boolean;
  /** Revenue / cost of events already delivered, and of those still booked. */
  revenue: number;
  bookedRevenue: number;
  cost: number;
  bookedCost: number;
  /** Margin over everything contracted that month, or null. */
  margin: number | null;
}

export interface CountryRow {
  name: string;
  count: number;
  revenue: number;
  cost: number;
}

export interface CostCategory {
  name: string;
  value: number;
  share: number;
}

export interface OwnerCard {
  name: string;
  email: string;
  delivered: number;
  booked: number;
  revenue: number;
  cost: number;
  unpaidCount: number;
  unpaidValue: number;
}

export interface ReportView {
  kpis: Kpis;
  months: MonthBar[];
  /** Highest value on the chart's y-axis. */
  chartMax: number;
  countries: CountryRow[];
  costCategories: CostCategory[];
  deliveredCost: number;
  owners: OwnerCard[];
  rows: ReportEvent[];
  totals: { revenue: number; cost: number; profit: number };
  /** Delivered events in view that have no contract value yet (so contribute nothing to revenue). */
  missingRevenue: number;
}

export interface ReportInput {
  events: ReportEvent[];
  year: number;
  period: PeriodOption;
  country: string | null;
  monthlyTarget: number;
  today: Date;
  sort: SortKey;
  dir: 1 | -1;
}

const sum = <T,>(arr: T[], pick: (t: T) => number) => arr.reduce((a, e) => a + pick(e), 0);

/** Cost categories, biggest first; everything past the fourth is folded into "Other". */
export function groupCostCategories(events: ReportEvent[], maxShown = 5): CostCategory[] {
  const totals: Record<string, number> = {};
  for (const e of events) {
    for (const [cat, v] of Object.entries(e.costByCategory)) totals[cat || 'General'] = (totals[cat || 'General'] ?? 0) + v;
  }
  const sorted = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const shown = sorted.length > maxShown ? sorted.slice(0, maxShown - 1) : sorted;
  const rest = sorted.length > maxShown ? sorted.slice(maxShown - 1) : [];
  const out = shown.map(([name, value]) => ({ name, value, share: 0 }));
  if (rest.length) out.push({ name: 'Other', value: sum(rest, (r) => r[1]), share: 0 });
  const total = sum(out, (c) => c.value);
  return out.map((c) => ({ ...c, share: total ? c.value / total : 0 }));
}

export function buildReport(input: ReportInput): ReportView {
  const { events, year, period, country, monthlyTarget, today, sort, dir } = input;

  const inPeriod = events.filter((e) => period.months.includes(e.month));
  const scoped = country ? inPeriod.filter((e) => e.country === country) : inPeriod;
  const delivered = scoped.filter((e) => !e.booked);
  const booked = scoped.filter((e) => e.booked);

  const revenue = sum(delivered, (e) => e.revenue);
  const cost = sum(delivered, (e) => e.cost);
  const unpaid = delivered.filter((e) => !e.paid && e.revenue > 0).sort((a, b) => a.endDate.localeCompare(b.endDate));

  const kpis: Kpis = {
    revenue,
    bookedRevenue: sum(booked, (e) => e.revenue),
    cost,
    profit: revenue - cost,
    deliveredCount: delivered.length,
    bookedCount: booked.length,
    receivables: sum(unpaid, (e) => e.revenue),
    unpaidCount: unpaid.length,
    oldestUnpaid: unpaid[0]?.code ?? null,
    target: monthlyTarget * elapsedMonths(period.months, year, today),
  };

  // Monthly chart: the whole year (so context stays visible), narrowed to the chosen country but not the period.
  const forChart = country ? events.filter((e) => e.country === country) : events;
  const months: MonthBar[] = MONTH_LABELS.map((label, month) => {
    const es = forChart.filter((e) => e.month === month);
    const del = es.filter((e) => !e.booked);
    const bk = es.filter((e) => e.booked);
    const r = sum(es, (e) => e.revenue);
    const c = sum(es, (e) => e.cost);
    return {
      month,
      label,
      inPeriod: period.months.includes(month),
      revenue: sum(del, (e) => e.revenue),
      bookedRevenue: sum(bk, (e) => e.revenue),
      cost: sum(del, (e) => e.cost),
      bookedCost: sum(bk, (e) => e.cost),
      margin: r > 0 ? (r - c) / r : null,
    };
  });
  const tallest = Math.max(0, ...months.map((m) => m.revenue + m.bookedRevenue), ...months.map((m) => m.cost + m.bookedCost));
  const chartMax = Math.max(monthlyTarget * 1.15, tallest, 1) * 1.08;

  // Countries ignore the country filter itself, so the list stays clickable to switch or clear.
  const byCountry: Record<string, CountryRow> = {};
  for (const e of inPeriod.filter((x) => !x.booked)) {
    const row = (byCountry[e.country] ??= { name: e.country, count: 0, revenue: 0, cost: 0 });
    row.count += 1;
    row.revenue += e.revenue;
    row.cost += e.cost;
  }
  const countries = Object.values(byCountry).sort((a, b) => b.revenue - a.revenue || b.count - a.count);

  const byOwner: Record<string, OwnerCard> = {};
  for (const e of scoped) {
    const o = (byOwner[e.ownerEmail || '—'] ??= {
      name: e.owner, email: e.ownerEmail, delivered: 0, booked: 0, revenue: 0, cost: 0, unpaidCount: 0, unpaidValue: 0,
    });
    if (e.booked) {
      o.booked += 1;
      continue;
    }
    o.delivered += 1;
    o.revenue += e.revenue;
    o.cost += e.cost;
    if (!e.paid && e.revenue > 0) {
      o.unpaidCount += 1;
      o.unpaidValue += e.revenue;
    }
  }
  const owners = Object.values(byOwner).sort((a, b) => b.revenue - a.revenue || b.delivered - a.delivered);

  const key: Record<SortKey, (e: ReportEvent) => string | number> = {
    code: (e) => e.code,
    month: (e) => e.month * 100 + parseInt(e.endDate.slice(8, 10), 10),
    revenue: (e) => e.revenue,
    profit: (e) => e.profit,
    margin: (e) => e.margin ?? -Infinity,
  };
  const rows = scoped.slice().sort((a, b) => {
    const x = key[sort](a);
    const y = key[sort](b);
    return (x > y ? 1 : x < y ? -1 : 0) * dir;
  });
  const tr = sum(scoped, (e) => e.revenue);
  const tc = sum(scoped, (e) => e.cost);

  return {
    kpis,
    months,
    chartMax,
    countries,
    costCategories: groupCostCategories(delivered),
    deliveredCost: cost,
    owners,
    rows,
    totals: { revenue: tr, cost: tc, profit: tr - tc },
    missingRevenue: delivered.filter((e) => e.revenue <= 0).length,
  };
}

/** Default direction when a column is first clicked: text and dates ascending, money and margin biggest first. */
export function defaultDir(key: SortKey): 1 | -1 {
  return key === 'code' || key === 'month' ? 1 : -1;
}

// ─── CSV ───────────────────────────────────────────────────────────────────

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The currently filtered rows as CSV: Event,City,Country,Month,Owner,Contract,Cost,Profit,Margin,Status. */
export function reportCsv(rows: ReportEvent[]): string {
  const header = 'Event,City,Country,Month,Owner,Contract,Cost,Profit,Margin,Status';
  const lines = rows.map((e) =>
    [e.code, e.city, e.country, MONTH_LABELS[e.month], e.owner, Math.round(e.revenue), Math.round(e.cost), Math.round(e.profit), marginText(e.revenue, e.cost), e.status]
      .map(csvCell)
      .join(','),
  );
  return [header, ...lines].join('\n');
}
