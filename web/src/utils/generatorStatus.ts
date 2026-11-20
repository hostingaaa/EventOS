/**
 * Per-event status of each document generator, for the Generators page.
 *
 * Sources (no dedicated backend endpoint exists for this):
 *  - Exported: the activity log entry each Drive save writes (`transfer_list_saved`, `av_equipment_saved` —
 *    shared by AV and Supplies, told apart by file name — and `service_report_saved`), plus the Service
 *    Report fields on the event row, plus a Drive link kept in this browser's saved copy.
 *  - Draft: a copy saved in this browser that never reached Drive.
 *  - Per Diem: printed from the browser, so only this browser's print record is known.
 */
import type { ActivityItem, Event } from '../types';
import type { TransferSetup } from '../pages/TransferListPage';
import { loadTransferList } from './transferListStore';
import { loadAVEquipment } from './avEquipmentStore';
import { loadSupplies } from './suppliesStore';
import { loadServiceReport } from './serviceReportStore';
import { loadPerDiemPrint, perDiemFileStem } from './perDiemStore';
import { transferListFilename } from './exportTransferList';
import { avEquipmentFilename } from './exportAVEquipment';
import { suppliesFilename } from './supplies';
import { serviceReportFilename } from './exportServiceReport';
import { formatIsoDate } from './dateFormat';
import { cityOfLocation } from './countries';
import { qrDefaultLabel, qrFilenameSlug } from './qrFilename';
import { getEventDateRange, toIsoDate } from './calendarDates';

export type DocGeneratorId = 'transfer' | 'av' | 'supplies' | 'perdiem' | 'service';
export type GeneratorId = DocGeneratorId | 'qr';
export type GeneratorState = 'done' | 'draft' | 'none';

export interface GeneratorStatus {
  state: GeneratorState;
  /** ISO time of the export / draft save. */
  at?: string;
  by?: string;
  /** The file the generator produced, or will produce for this event. */
  fileName: string;
  /** Drive link to the exported file, when known. */
  fileUrl?: string;
}

interface Source {
  at: string;
  by: string;
  fileName?: string;
  url?: string;
}

const SUPPLIES_FILE = /_Supplies\.xlsx$/i;

function time(iso: string | undefined): number {
  const t = iso ? Date.parse(iso) : NaN;
  return isNaN(t) ? 0 : t;
}

function newest<T extends { at: string }>(items: (T | null | undefined)[]): T | null {
  let best: T | null = null;
  for (const it of items) if (it && (!best || time(it.at) > time(best.at))) best = it;
  return best;
}

function latestActivity(activity: ActivityItem[], match: (a: ActivityItem) => boolean): Source | null {
  return newest(
    activity.filter(match).map((a) => ({ at: a.createdAt, by: a.actor, fileName: a.summary || undefined })),
  );
}

/** Exported if any export is known; otherwise Draft if this browser holds an unexported copy. */
function combine(local: Source | null, exports: (Source | null)[], fallbackName: string): GeneratorStatus {
  const localExport = local?.url ? local : null;
  const exported = newest([...exports, localExport]);
  const named = newest([exported, local].filter((s): s is Source => !!s?.fileName));
  const fileName = named?.fileName || fallbackName;
  if (exported) {
    const url = localExport?.url || exports.find((s) => s?.url)?.url;
    return { state: 'done', at: exported.at, by: exported.by, fileName, fileUrl: url };
  }
  if (local) return { state: 'draft', at: local.at, by: local.by, fileName };
  return { state: 'none', fileName };
}

const eventDate = (ev: Event) => (ev.startDate ? formatIsoDate(ev.startDate) : '');

/** What each generator would name its file for this event, before anything is saved (same rules as the generators). */
export function defaultFileNames(ev: Event): Record<GeneratorId, string> {
  const base = { eventCode: ev.code, eventRowId: ev.rowId ?? '', eventCity: ev.location ?? '', eventDate: eventDate(ev) };
  return {
    transfer: transferListFilename({ ...base, eventDates: ev.dates ?? '', hotel: '', arrivalAirport: '', departureAirport: '' } as TransferSetup),
    // The filename helpers only read code / city / date from their setup objects.
    av: avEquipmentFilename(base as Parameters<typeof avEquipmentFilename>[0]),
    supplies: suppliesFilename(base),
    perdiem: `${perDiemFileStem(ev.code, cityOfLocation(ev.location ?? ''), '')}.pdf`,
    service: serviceReportFilename(base as Parameters<typeof serviceReportFilename>[0]),
    qr: `${qrFilenameSlug(qrDefaultLabel(ev.code))}.png`,
  };
}

/**
 * Status of the five document generators for an event. Pass `activity` once the event's activity feed has
 * loaded (null before that: statuses then come from this browser only).
 */
export function generatorStatuses(ev: Event, activity: ActivityItem[] | null): Record<DocGeneratorId, GeneratorStatus> {
  const names = defaultFileNames(ev);
  const log = (activity ?? []).filter((a) => a.eventCode === ev.code);

  const transferLocal = loadTransferList(ev.code);
  const avLocal = loadAVEquipment(ev.code);
  const suppliesLocal = loadSupplies(ev.code);
  const serviceLocal = loadServiceReport(ev.code);
  const perDiem = loadPerDiemPrint(ev.code);

  const local = (
    saved: { savedAt: string; savedBy: string; driveUrl?: string } | null,
    fileName: () => string,
  ): Source | null => (saved ? { at: saved.savedAt, by: saved.savedBy, url: saved.driveUrl, fileName: fileName() } : null);

  const serviceOnEvent: Source | null = ev.serviceReportSavedAt
    ? { at: ev.serviceReportSavedAt, by: ev.serviceReportSavedBy ?? '', url: ev.serviceReportDriveUrl || undefined }
    : null;

  return {
    transfer: combine(
      local(transferLocal, () => transferListFilename(transferLocal!.setup)),
      [latestActivity(log, (a) => a.type === 'transfer_list_saved')],
      names.transfer,
    ),
    av: combine(
      local(avLocal, () => avEquipmentFilename(avLocal!.setup)),
      [latestActivity(log, (a) => a.type === 'av_equipment_saved' && !SUPPLIES_FILE.test(a.summary))],
      names.av,
    ),
    supplies: combine(
      local(suppliesLocal, () => suppliesFilename(suppliesLocal!.setup)),
      [latestActivity(log, (a) => a.type === 'av_equipment_saved' && SUPPLIES_FILE.test(a.summary))],
      names.supplies,
    ),
    perdiem: perDiem
      ? { state: 'done', at: perDiem.printedAt, by: perDiem.printedBy, fileName: perDiem.fileName || names.perdiem }
      : { state: 'none', fileName: names.perdiem },
    service: combine(
      local(serviceLocal, () => serviceReportFilename(serviceLocal!.setup)),
      [latestActivity(log, (a) => a.type === 'service_report_saved'), serviceOnEvent],
      names.service,
    ),
  };
}

/** Links into each generator with the event pre-selected (the parameters each generator page already reads). */
export function generatorHref(id: GeneratorId, ev: Event): string {
  const q = new URLSearchParams({ code: ev.code });
  const add = (k: string, v: string | undefined) => {
    if (v && v.trim()) q.set(k, v.trim());
  };
  switch (id) {
    case 'transfer':
      add('city', ev.location);
      add('dates', ev.dates);
      return `/transfer-list?${q}`;
    case 'av':
    case 'supplies':
    case 'service':
      add('city', ev.location);
      add('dates', eventDate(ev));
      return `/${id === 'av' ? 'av-equipment' : id === 'supplies' ? 'supplies-materials' : 'service-report'}?${q}`;
    case 'perdiem':
      add('event', ev.location || ev.code);
      add('location', ev.location);
      add('dates', ev.dates);
      add('rate', ev.perDiemRate);
      add('visa', ev.maxVisaAllowance);
      add('ground', ev.maxGroundTransport);
      return `/per-diem-form?${q}`;
    case 'qr':
      return `/qr-code?${q}`;
  }
}

/** "just now", "5m ago", "3h ago", "yesterday", "4d ago", "2w ago", then "Nov 2" (or "Nov 2, 2025"). */
export function formatAgo(iso: string | undefined, now: Date = new Date()): string {
  const t = time(iso);
  if (!t) return '';
  const diff = now.getTime() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const then = new Date(t);
  const hours = Math.floor(min / 60);
  const dayGap = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) /
      86400000,
  );
  if (dayGap === 0) return `${hours}h ago`;
  if (dayGap === 1) return 'yesterday';
  if (dayGap < 7) return `${dayGap}d ago`;
  if (dayGap < 28) return `${Math.floor(dayGap / 7)}w ago`;
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (then.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return then.toLocaleDateString('en-US', opts);
}

export interface EventPhase {
  label: string;
  /** 0 = happening now, 1 = upcoming, 2 = finished, 3 = no dates. Used for ordering. */
  rank: 0 | 1 | 2 | 3;
  /** Days until start (upcoming) or since end (finished). */
  days: number;
}

export function eventPhase(ev: Event, today: Date = new Date()): EventPhase {
  const range = getEventDateRange(ev);
  if (!range) return { label: '', rank: 3, days: 0 };
  const todayIso = toIsoDate(today);
  const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00`) - Date.parse(`${b}T12:00:00`)) / 86400000);
  if (range.start <= todayIso && todayIso <= range.end) return { label: 'Live now', rank: 0, days: 0 };
  if (range.start > todayIso) {
    const d = dayDiff(range.start, todayIso);
    return { label: d === 1 ? 'Tomorrow' : `In ${d} days`, rank: 1, days: d };
  }
  return { label: 'Closed', rank: 2, days: dayDiff(todayIso, range.end) };
}

/** "Nov 19–20", "Nov 30 – Dec 2", "Nov 5" — falls back to the sheet's own Dates text. */
export function shortEventDates(ev: Event): string {
  const range = getEventDateRange(ev);
  if (!range) return ev.dates ?? '';
  const s = new Date(`${range.start}T12:00:00`);
  const e = new Date(`${range.end}T12:00:00`);
  const mon = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
  if (range.start === range.end) return `${mon(s)} ${s.getDate()}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) return `${mon(s)} ${s.getDate()}–${e.getDate()}`;
  return `${mon(s)} ${s.getDate()} – ${mon(e)} ${e.getDate()}`;
}
