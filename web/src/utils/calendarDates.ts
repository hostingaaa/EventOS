/** Calendar grid helpers for the team timeline view. */

import { parseToIsoDate } from './dateFormat';

export interface CalendarDay {
  date: Date;
  iso: string;
  dayNum: number;
  weekday: string;
  isWeekend: boolean;
  isToday: boolean;
}

export interface EventDateFields {
  startDate?: string;
  endDate?: string;
  dates?: string;
  monthGroup?: string;
}

export interface ResolvedEventDates {
  start: string;
  end: string;
}

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTH_INDEX: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

export function parseIsoDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s + (s.length === 10 ? 'T12:00:00' : ''));
  return isNaN(d.getTime()) ? null : d;
}

/** Normalize any parseable date string to YYYY-MM-DD. */
export function normalizeIsoDate(s: string | undefined): string | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  const fromDisplay = parseToIsoDate(t);
  if (fromDisplay) return fromDisplay;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = parseIsoDate(t);
  if (d) return toIsoDate(d);
  const parsed = new Date(t);
  if (!isNaN(parsed.getTime())) {
    return toIsoDate(new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0));
  }
  return null;
}

function yearFromMonthGroup(monthGroup: string | undefined): number | null {
  if (!monthGroup) return null;
  const m = monthGroup.match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

function monthIndexFromName(name: string): number | null {
  const key = name.trim().toLowerCase();
  if (key in MONTH_INDEX) return MONTH_INDEX[key];
  return null;
}

function isoFromParts(year: number, monthIndex: number, day: number): string {
  return toIsoDate(new Date(year, monthIndex, day, 12, 0, 0, 0));
}

/** Parse human-readable dates labels like "Jun 10–11, 2026" or "Apr 28–30". */
function parseDatesLabel(
  dates: string,
  monthGroup?: string,
): ResolvedEventDates | null {
  const cleaned = dates.replace(/[\u2013\u2014]/g, '-').trim();
  if (!cleaned) return null;

  const displayRange = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s*-\s*(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (displayRange) {
    const start = parseToIsoDate(`${displayRange[1]}-${displayRange[2]}-${displayRange[3]}`);
    const end = parseToIsoDate(`${displayRange[4]}-${displayRange[5]}-${displayRange[6]}`);
    if (start && end) return { start, end };
  }

  const displaySingle = parseToIsoDate(cleaned);
  if (displaySingle) return { start: displaySingle, end: displaySingle };

  const rangeMatch = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})\s*-\s*(\d{1,2})(?:,\s*(20\d{2}))?$/);
  if (rangeMatch) {
    const monthIndex = monthIndexFromName(rangeMatch[1]);
    if (monthIndex == null) return null;
    const year = rangeMatch[4] ? Number(rangeMatch[4]) : yearFromMonthGroup(monthGroup);
    if (!year) return null;
    return {
      start: isoFromParts(year, monthIndex, Number(rangeMatch[2])),
      end: isoFromParts(year, monthIndex, Number(rangeMatch[3])),
    };
  }

  const singleMatch = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*(20\d{2}))?$/);
  if (singleMatch) {
    const monthIndex = monthIndexFromName(singleMatch[1]);
    if (monthIndex == null) return null;
    const year = singleMatch[3] ? Number(singleMatch[3]) : yearFromMonthGroup(monthGroup);
    if (!year) return null;
    const iso = isoFromParts(year, monthIndex, Number(singleMatch[2]));
    return { start: iso, end: iso };
  }

  return null;
}

/**
 * Resolve calendar placement dates from ISO fields or the human "dates" label
 * used on the events dashboard (e.g. "Jun 10–11, 2026").
 */
export function getEventDateRange(ev: EventDateFields): ResolvedEventDates | null {
  const startIso = normalizeIsoDate(ev.startDate);
  const endIso = normalizeIsoDate(ev.endDate) || startIso;
  if (startIso) {
    return { start: startIso, end: endIso || startIso };
  }
  return parseDatesLabel(ev.dates || '', ev.monthGroup);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0, 0);
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayAtNoon(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

/** Enumerate every ISO date from start to end, inclusive. */
export function expandDateRange(startIso: string, endIso: string): string[] {
  const start = parseIsoDate(startIso);
  if (!start) return [];
  const end = parseIsoDate(endIso) || start;
  const out: string[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(toIsoDate(d));
  }
  return out;
}

export function buildMonthDays(month: Date): CalendarDay[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const todayIso = toIsoDate(todayAtNoon());
  const days: CalendarDay[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const copy = new Date(d);
    copy.setHours(12, 0, 0, 0);
    const iso = toIsoDate(copy);
    const dow = copy.getDay();
    days.push({
      date: copy,
      iso,
      dayNum: copy.getDate(),
      weekday: WEEKDAY[dow],
      isWeekend: dow === 0 || dow === 6,
      isToday: iso === todayIso,
    });
  }
  return days;
}

/** Inclusive day index within a month grid (1-based column for CSS grid). */
export function dayColumn(iso: string, days: CalendarDay[]): number | null {
  const idx = days.findIndex((d) => d.iso === iso);
  return idx >= 0 ? idx + 2 : null; // +2: column 1 is the label
}

/** Clamp event range to visible month; returns [startCol, span] or null if no overlap. */
export function eventBarSpan(
  startIso: string,
  endIso: string,
  days: CalendarDay[],
): { startCol: number; span: number } | null {
  if (!days.length) return null;
  const monthStart = days[0].iso;
  const monthEnd = days[days.length - 1].iso;
  const start = startIso < monthStart ? monthStart : startIso;
  const end = (endIso || startIso) > monthEnd ? monthEnd : endIso || startIso;
  if (start > monthEnd || end < monthStart) return null;

  const startIdx = days.findIndex((d) => d.iso === start);
  const endIdx = days.findIndex((d) => d.iso === end);
  const s = startIdx >= 0 ? startIdx : 0;
  const e = endIdx >= 0 ? endIdx : days.length - 1;
  return { startCol: s + 2, span: e - s + 1 };
}

/** Assign vertical lanes for overlapping events on one row. */
export function assignEventLanes(
  events: Array<{ id: string; start: string; end: string }>,
): Map<string, number> {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));
  const laneEnds: string[] = [];
  const map = new Map<string, number>();

  for (const ev of sorted) {
    const start = ev.start;
    const end = ev.end || ev.start;
    let lane = 0;
    while (laneEnds[lane] !== undefined && laneEnds[lane] >= start) lane++;
    laneEnds[lane] = end;
    map.set(ev.id, lane);
  }
  return map;
}

export const EVENT_BAR_PALETTE = [
  { bg: '#ffedd5', border: '#fb923c', text: '#9a3412' },
  { bg: '#dbeafe', border: '#60a5fa', text: '#1e40af' },
  { bg: '#dcfce7', border: '#4ade80', text: '#166534' },
  { bg: '#fce7f3', border: '#f472b6', text: '#9d174d' },
  { bg: '#fef9c3', border: '#facc15', text: '#854d0e' },
  { bg: '#ede9fe', border: '#a78bfa', text: '#5b21b6' },
  { bg: '#ccfbf1', border: '#2dd4bf', text: '#115e59' },
  { bg: '#e0e7ff', border: '#818cf8', text: '#3730a3' },
] as const;

export function eventColorIndex(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h + code.charCodeAt(i) * (i + 1)) % EVENT_BAR_PALETTE.length;
  return h;
}
