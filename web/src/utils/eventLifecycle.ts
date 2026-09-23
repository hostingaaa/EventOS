/** Shared lifecycle checks for events — used by both the dashboard (to split
 * active/completed) and the event workspace (to expose the Awarded/Completed
 * admin actions). */
import type { Event } from '../types';
import { parseIsoDate, todayAtNoon } from './calendarDates';

/** Days past endDate after which an event is treated as completed even if
 * never explicitly marked complete. */
export const COMPLETED_THRESHOLD_DAYS = 15;

/** Real, admin-set backend field — "Yes" once awarded. */
export function isEventAwarded(ev: Event): boolean {
  return (ev.awarded ?? '').trim().toLowerCase() === 'yes';
}

/** Real, admin-set backend field — "Yes" once explicitly marked complete. */
export function isEventManuallyCompleted(ev: Event): boolean {
  return (ev.completed ?? '').trim().toLowerCase() === 'yes';
}

export function isEventCompleted(ev: Event): boolean {
  if (isEventManuallyCompleted(ev)) return true;
  const end = parseIsoDate(ev.endDate);
  if (!end) return false;
  return Math.floor((todayAtNoon().getTime() - end.getTime()) / 86_400_000) > COMPLETED_THRESHOLD_DAYS;
}
