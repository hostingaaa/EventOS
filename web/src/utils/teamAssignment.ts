/** Multi-person event staffing — parses/serializes the comma-joined
 * `Event.assignedTeam` field and answers staffing questions (who's the
 * lead, is someone double-booked) used by the Calendar page and the
 * "Assigned team" picker in EventDetail.tsx. Never written back to
 * `Event.ownerEmail` — see the field's doc comment in types.ts for why. */
import type { Event } from '../types';
import { getEventDateRange } from './calendarDates';

type Staffed = Pick<Event, 'assignedTeam'> & Partial<Pick<Event, 'ownerEmail'>>;

/** Emails assigned to this event, in order. The first is the lead. Until a
 * team is picked explicitly, the event's owner (e.g. the member chosen in
 * the SOW Generator) counts as its lead, so new events show up on that
 * person's calendar straight away. This is read-only: nothing is written
 * back to either field. */
export function parseAssignedTeam(ev: Staffed): string[] {
  const team = (ev.assignedTeam ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  if (team.length) return team;
  const owner = (ev.ownerEmail ?? '').trim();
  return owner ? [owner] : [];
}

export function serializeAssignedTeam(emails: string[]): string {
  return emails.map((e) => e.trim()).filter(Boolean).join(',');
}

/** The first assigned email, or undefined if the event has no team yet. */
export function getEventLead(ev: Staffed): string | undefined {
  return parseAssignedTeam(ev)[0];
}

export function isPersonOnEvent(ev: Staffed, email: string): boolean {
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
