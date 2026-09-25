/** Multi-person event staffing — parses/serializes the comma-joined
 * `Event.assignedTeam` field and answers staffing questions (who's the
 * lead, is someone double-booked) used by the Calendar page and the
 * "Assigned team" picker in EventDetail.tsx. Deliberately independent of
 * `Event.ownerEmail` — see the field's doc comment in types.ts for why. */
import type { Event } from '../types';
import { getEventDateRange } from './calendarDates';

/** Emails assigned to this event, in order. The first is the lead. */
export function parseAssignedTeam(ev: Pick<Event, 'assignedTeam'>): string[] {
  return (ev.assignedTeam ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

export function serializeAssignedTeam(emails: string[]): string {
  return emails.map((e) => e.trim()).filter(Boolean).join(',');
}

/** The first assigned email, or undefined if the event has no team yet. */
export function getEventLead(ev: Pick<Event, 'assignedTeam'>): string | undefined {
  return parseAssignedTeam(ev)[0];
}

export function isPersonOnEvent(ev: Pick<Event, 'assignedTeam'>, email: string): boolean {
  const target = email.trim().toLowerCase();
  return parseAssignedTeam(ev).some((e) => e.toLowerCase() === target);
}

/** True if `email` is assigned to another event (not `currentRowId`) whose
 * date range overlaps this one's, inclusive of both endpoints. */
export function isDoubleBooked(
  email: string,
  currentRowId: string,
  currentEvent: Pick<Event, 'startDate' | 'endDate' | 'dates' | 'monthGroup'>,
  allEvents: Event[],
): boolean {
  const range = getEventDateRange(currentEvent);
  if (!range) return false;
  return allEvents.some((other) => {
    if (other.rowId === currentRowId) return false;
    if (!isPersonOnEvent(other, email)) return false;
    const otherRange = getEventDateRange(other);
    if (!otherRange) return false;
    return range.start <= otherRange.end && otherRange.start <= range.end;
  });
}
