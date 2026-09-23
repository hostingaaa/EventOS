/** Shared lifecycle status for events — used by both the dashboard (to split
 * active/inactive) and the event workspace (to expose the Status dropdown). */
import type { Event } from '../types';

export const EVENT_STATUSES = ['Proposed', 'Awarded', 'Completed', 'Postponed', 'Cancelled', 'Archived'] as const;
export type EventStatus = typeof EVENT_STATUSES[number];

function isLegacyAwarded(ev: Event): boolean {
  return (ev.awarded ?? '').trim().toLowerCase() === 'yes';
}

/** The event's lifecycle status. Defaults to 'Proposed' for events with no
 * status set yet — except events already marked Awarded under the old
 * boolean `awarded` field (before this dropdown existed), which keep
 * showing as Awarded so nothing appears to silently revert on rollout. Once
 * an admin explicitly picks anything via the new dropdown, the real
 * `status` value takes over and this fallback is bypassed for good. */
export function getEventStatus(ev: Event): EventStatus {
  const raw = (ev.status ?? '').trim();
  if ((EVENT_STATUSES as readonly string[]).includes(raw)) return raw as EventStatus;
  return isLegacyAwarded(ev) ? 'Awarded' : 'Proposed';
}

export function isEventActive(ev: Event): boolean {
  const s = getEventStatus(ev);
  return s === 'Proposed' || s === 'Awarded';
}

/** Postponed, Cancelled, or Archived — set aside from a real Completed status. */
export function isEventSetAside(ev: Event): boolean {
  const s = getEventStatus(ev);
  return s === 'Postponed' || s === 'Cancelled' || s === 'Archived';
}
