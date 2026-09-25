import type { Event, EventsResponse, EventUpdates } from '../types';
import {
  appendExtraEvent,
  getExtraEvents,
  purgeEventFromMockState,
  removeExtraEventByRowId,
  updateExtraEvent,
} from './mockStore';

const DESIGNS_KEY = 'event_designs_v1';

function purgeLocalTransferList(eventCode: string): void {
  localStorage.removeItem(`tl-save-${eventCode.trim().toUpperCase()}`);
}

function purgeLocalEventDesign(eventCode: string): void {
  try {
    const raw = localStorage.getItem(DESIGNS_KEY);
    if (!raw) return;
    const store = JSON.parse(raw) as Record<string, unknown>;
    delete store[eventCode];
    localStorage.setItem(DESIGNS_KEY, JSON.stringify(store));
  } catch { /* ignore */ }
}

const DELETED_ROW_IDS_KEY = 'deleted_mock_event_row_ids';

function getDeletedRowIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_ROW_IDS_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function markRowIdDeleted(rowId: string): void {
  const ids = getDeletedRowIds();
  ids.add(rowId);
  localStorage.setItem(DELETED_ROW_IDS_KEY, JSON.stringify([...ids]));
}

const seedEvents: Event[] = [
  {
    // Marked Completed → shows in the Inactive events section
    rowNumber: 2,
    rowId: 'mock-1',
    code: 'J182-4',
    location: 'Tbilisi',
    dates: 'Apr 28–30',
    lem: 'Closed',
    av: 'Yes',
    interpreters: 'PSA',
    venue: 'Biltmore Hotel',
    psaCldp: 'PSA',
    sow: 'https://drive.google.com/',
    notes: '',
    monthGroup: 'April 2026',
    startDate: '2026-04-28',
    endDate: '2026-04-30',
    ownerEmail: 'sara@team.org',
    lastReminder: '',
    status: 'Completed',
  },
  {
    // Ended 7 days ago → still active (within 15-day window), show as recently concluded
    rowNumber: 3,
    rowId: 'mock-2',
    code: 'J097',
    location: 'Istanbul',
    dates: 'May 13–15',
    lem: 'Full/Connectmice',
    av: 'No',
    interpreters: 'Connectmice',
    venue: 'Hilton Bosphorus',
    psaCldp: '',
    sow: '??',
    notes: 'Catering & Prof. Video',
    monthGroup: 'May 2026',
    startDate: '2026-05-13',
    endDate: '2026-05-15',
    ownerEmail: 'mark@team.org',
    lastReminder: '',
    assignedTeam: 'lead@team.org,director@team.org',
  },
  {
    // Starts in 3 days → IMMINENT
    rowNumber: 4,
    rowId: 'mock-3',
    code: 'J264',
    location: 'Colombo',
    dates: 'May 25–26',
    lem: 'Open',
    av: 'Yes',
    interpreters: 'NO',
    venue: '',
    psaCldp: '',
    sow: '',
    notes: 'Arrange catering??',
    monthGroup: 'May 2026',
    startDate: '2026-05-25',
    endDate: '2026-05-26',
    ownerEmail: 'aisha@team.org',
    lastReminder: '',
    assignedTeam: 'director@team.org,admin@team.org',
  },
  {
    // Starts in 6 days → IMMINENT
    rowNumber: 5,
    rowId: 'mock-6',
    code: 'J315',
    location: 'Amman',
    dates: 'May 28–29',
    lem: 'Closed',
    av: 'Yes',
    interpreters: 'PSA',
    venue: 'InterContinental',
    psaCldp: 'CLDP',
    sow: 'https://drive.google.com/',
    notes: '',
    monthGroup: 'May 2026',
    startDate: '2026-05-28',
    endDate: '2026-05-29',
    ownerEmail: 'mark@team.org',
    lastReminder: '',
    assignedTeam: 'lead@team.org',
  },
  {
    // Starts in 14 days → upcoming
    rowNumber: 10,
    rowId: 'mock-4',
    code: 'J301',
    location: 'Tunis',
    dates: 'Jun 5–7',
    lem: 'Closed',
    av: 'Yes',
    interpreters: 'PSA',
    venue: 'Conference Center',
    psaCldp: 'CLDP',
    sow: 'https://drive.google.com/',
    notes: '',
    monthGroup: 'June 2026',
    startDate: '2026-06-05',
    endDate: '2026-06-07',
    ownerEmail: 'sara@team.org',
    lastReminder: '',
  },
  {
    // Starts in 27 days → upcoming
    rowNumber: 11,
    rowId: 'mock-5',
    code: 'J288',
    location: 'Rabat',
    dates: 'Jun 18–20',
    lem: 'Full/Connectmice',
    av: 'No',
    interpreters: 'Connectmice',
    venue: '',
    psaCldp: '',
    sow: '??',
    notes: '',
    monthGroup: 'June 2026',
    startDate: '2026-06-18',
    endDate: '2026-06-20',
    ownerEmail: '',
    lastReminder: '',
  },
  {
    // Further future → upcoming
    rowNumber: 12,
    rowId: 'mock-7',
    code: 'J340',
    location: 'Nairobi',
    dates: 'Jul 8–10',
    lem: 'Open',
    av: 'Yes',
    interpreters: 'PSA',
    venue: '',
    psaCldp: '',
    sow: '',
    notes: '',
    monthGroup: 'July 2026',
    startDate: '2026-07-08',
    endDate: '2026-07-10',
    ownerEmail: 'aisha@team.org',
    lastReminder: '',
  },
];

export function getAllMockEvents(): Event[] {
  const deleted = getDeletedRowIds();
  return [...seedEvents, ...getExtraEvents()].filter((e) => !deleted.has(e.rowId));
}

export const mockEventsResponse = {
  get events(): Event[] {
    return getAllMockEvents();
  },
  get months(): string[] {
    const set = new Set<string>();
    getAllMockEvents().forEach((e) => {
      if (e.monthGroup) set.add(e.monthGroup);
    });
    return Array.from(set).sort();
  },
} as unknown as EventsResponse;

export function findMockEvent(opts: {
  rowId?: string;
  code?: string;
}): Event | null {
  return (
    getAllMockEvents().find((e) => {
      if (opts.rowId && e.rowId === opts.rowId) return true;
      if (opts.code && e.code === opts.code) return true;
      return false;
    }) ?? null
  );
}

export function updateMockEvent(rowId: string, updates: EventUpdates): Event {
  const seedIdx = seedEvents.findIndex((e) => e.rowId === rowId);
  if (seedIdx >= 0) {
    seedEvents[seedIdx] = { ...seedEvents[seedIdx], ...updates };
    return seedEvents[seedIdx];
  }
  const extra = updateExtraEvent(rowId, updates);
  if (extra) return extra;
  throw new Error('Event not found');
}

function monthGroupFromDate(startDate: string): string {
  if (!startDate) return '';
  const d = new Date(startDate);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

export function createMockEvent(payload: Partial<Event> & { code: string }): Event {
  const existing = getAllMockEvents();
  if (existing.some((e) => e.code.toLowerCase() === payload.code.toLowerCase())) {
    throw new Error(`An event with code "${payload.code}" already exists`);
  }

  const startDate = payload.startDate || '';
  const event: Event = {
    rowNumber: existing.length + 2,
    rowId: 'mock-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    code: payload.code,
    location: payload.location || '',
    dates: payload.dates || '',
    lem: payload.lem || 'Open',
    av: payload.av || '',
    interpreters: payload.interpreters || '',
    venue: payload.venue || '',
    psaCldp: payload.psaCldp || '',
    sow: payload.sow || '',
    notes: payload.notes || '',
    monthGroup: payload.monthGroup || monthGroupFromDate(startDate),
    startDate,
    endDate: payload.endDate || startDate,
    ownerEmail: payload.ownerEmail || '',
    lastReminder: '',
  };

  appendExtraEvent(event);
  return event;
}

export function deleteMockEvent(rowId: string, code: string): void {
  const ev = findMockEvent({ rowId, code });
  if (!ev) throw new Error('Event not found');

  const removedExtra = removeExtraEventByRowId(rowId);
  if (!removedExtra) markRowIdDeleted(rowId);

  purgeEventFromMockState(ev.code);
  purgeLocalTransferList(ev.code);
  purgeLocalEventDesign(ev.code);
}
