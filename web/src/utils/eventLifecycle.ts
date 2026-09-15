/** Shared "archived" state + completion check for events — used by both the
 * dashboard (to split active/completed) and the event workspace (to expose
 * the archive/restore action for admins). Archiving is a client-only concept
 * (no backend field), stored under this one localStorage key. */
import type { Event } from '../types';
import { parseIsoDate, todayAtNoon } from './calendarDates';

const STORAGE_KEY = 'archived_events';

/** Days past endDate after which an event is treated as completed even if
 * never explicitly archived. */
export const COMPLETED_THRESHOLD_DAYS = 15;

export function getArchivedCodes(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveArchivedCodes(codes: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...codes]));
}

export function archiveEvent(code: string): Set<string> {
  const next = new Set(getArchivedCodes());
  next.add(code);
  saveArchivedCodes(next);
  return next;
}

export function unarchiveEvent(code: string): Set<string> {
  const next = new Set(getArchivedCodes());
  next.delete(code);
  saveArchivedCodes(next);
  return next;
}

export function isEventCompleted(ev: Event, archivedCodes: Set<string>): boolean {
  if (archivedCodes.has(ev.code)) return true;
  const end = parseIsoDate(ev.endDate);
  if (!end) return false;
  return Math.floor((todayAtNoon().getTime() - end.getTime()) / 86_400_000) > COMPLETED_THRESHOLD_DAYS;
}
