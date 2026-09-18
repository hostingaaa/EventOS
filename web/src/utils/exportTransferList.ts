/**
 * Generates a styled Excel (.xlsx) Transfer List matching the PSA template:
 *  - Title row:  background #FDEADA  (light peach)
 *  - Header row: background #DBEEF4  (light blue)
 *  - Separator:  background #002060  (dark navy)  — blank row between groups
 *  - Data rows:  no fill
 *
 * Vehicle auto-assignment by group size:
 *   1–2 → SEDAN   3–7 → VAN   8–14 → SPRINTER   15–24 → MINIBUS   25–45 → BUS
 */
import XLSXStyle from 'xlsx-js-style';
import type { TravelerEntry, TransferSetup } from '../pages/TransferListPage';

// ─── vehicle logic ─────────────────────────────────────────────────────────

export function vehicleForCount(n: number): string {
  if (n <= 2)  return 'SEDAN';
  if (n <= 7)  return 'VAN';
  if (n <= 14) return 'SPRINTER';
  if (n <= 24) return 'MINIBUS';
  return 'BUS';
}

// ─── cell style helpers ────────────────────────────────────────────────────

type CellStyle = Record<string, unknown>;

const BLACK = '000000';
const BORDER_BLACK = { style: 'thin', color: { rgb: BLACK } };
const BORDER_MEDIUM = { style: 'medium', color: { rgb: BLACK } };

const S_TITLE: CellStyle = {
  fill:      { fgColor: { rgb: 'FDEADA' } },
  font:      { bold: true, sz: 13 },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top:    BORDER_MEDIUM,
    bottom: BORDER_MEDIUM,
    left:   BORDER_MEDIUM,
    right:  BORDER_MEDIUM,
  },
};

const S_HEADER: CellStyle = {
  fill:      { fgColor: { rgb: 'DBEEF4' } },
  font:      { bold: true, sz: 10, color: { rgb: BLACK } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top:    BORDER_BLACK,
    bottom: BORDER_BLACK,
    left:   BORDER_BLACK,
    right:  BORDER_BLACK,
  },
};

const S_SEPARATOR: CellStyle = {
  fill:      { fgColor: { rgb: '002060' } },
  font:      { bold: false, sz: 6, color: { rgb: '002060' } },
  alignment: {},
  border:    {},
};

// All data rows share the same style: bold, centered, black border
const S_DATA_FIRST: CellStyle = {
  fill:      { fgColor: { rgb: 'FFFFFF' } },
  font:      { bold: true, sz: 10, color: { rgb: BLACK } },
  alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
  border: {
    top:    BORDER_BLACK,
    bottom: BORDER_BLACK,
    left:   BORDER_BLACK,
    right:  BORDER_BLACK,
  },
};

const S_DATA: CellStyle = {
  fill:      { fgColor: { rgb: 'FFFFFF' } },
  font:      { bold: true, sz: 10, color: { rgb: BLACK } },
  alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
  border: {
    top:    BORDER_BLACK,
    bottom: BORDER_BLACK,
    left:   BORDER_BLACK,
    right:  BORDER_BLACK,
  },
};

function cell(v: string | number | null, s: CellStyle) {
  return { v: v ?? '', t: typeof v === 'number' ? 'n' : 's', s };
}

/**
 * Title cell: "From {AIRPORT} to {HOTEL}"
 * Entire cell: bold, size 20, dark red, peach background, centered.
 */
function titleCell(from: string, to: string): unknown {
  return {
    v: `From ${from || '{Airport/Hotel}'} to ${to || '{Hotel/Airport}'}`,
    t: 's',
    s: {
      fill:      { fgColor: { rgb: 'FDEADA' } },
      font:      { bold: true, sz: 20, color: { rgb: 'C00000' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
      border: {
        top:    BORDER_MEDIUM,
        bottom: BORDER_MEDIUM,
        left:   BORDER_MEDIUM,
        right:  BORDER_MEDIUM,
      },
    },
  };
}

function blankRow(cols: number): unknown[] {
  return Array.from({ length: cols }, () => cell('', S_SEPARATOR));
}

// ─── grouping helpers ──────────────────────────────────────────────────────

interface ArrivalGroup {
  key:      string;   // date|flight|time
  date:     string;
  flight:   string;
  time:     string;
  members:  TravelerEntry[];
}

interface DepartureGroup {
  key:      string;
  date:     string;
  flight:   string;
  time:     string;
  pickup:   string;
  members:  TravelerEntry[];
}

function groupArrivals(travelers: TravelerEntry[]): ArrivalGroup[] {
  const map = new Map<string, ArrivalGroup>();
  for (const t of travelers) {
    if (!t.arrivalFlight && !t.arrivalDate) continue;   // skip if no arrival
    const key = `${t.arrivalDate}|${t.arrivalFlight}|${t.arrivalTime}`;
    if (!map.has(key)) {
      map.set(key, { key, date: t.arrivalDate, flight: t.arrivalFlight, time: t.arrivalTime, members: [] });
    }
    map.get(key)!.members.push(t);
  }
  // Sort by date then time
  return [...map.values()].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.time.localeCompare(b.time);
  });
}

function groupDepartures(travelers: TravelerEntry[]): DepartureGroup[] {
  const map = new Map<string, DepartureGroup>();
  for (const t of travelers) {
    if (!t.departureFlight && !t.departureDate) continue;
    const key = `${t.departureDate}|${t.departureFlight}|${t.departureTime}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        date:   t.departureDate,
        flight: t.departureFlight,
        time:   t.departureTime,
        pickup: t.departurePickup,
        members: [],
      });
    }
    map.get(key)!.members.push(t);
  }
  return [...map.values()].sort((a, b) => {
    const d = a.date.localeCompare(b.date);
    return d !== 0 ? d : a.time.localeCompare(b.time);
  });
}

/** Tally vehicle types needed across all arrival + departure flight groups (one vehicle per group). */
export function computeVehicleCounts(travelers: TravelerEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const groups: { members: TravelerEntry[] }[] = [...groupArrivals(travelers), ...groupDepartures(travelers)];
  for (const g of groups) {
    const vehicle = vehicleForCount(g.members.length);
    counts[vehicle] = (counts[vehicle] ?? 0) + 1;
  }
  return counts;
}

// ─── sheet builders ────────────────────────────────────────────────────────

const ARR_COLS = 9;
const DEP_COLS = 9;

// Columns to merge vertically within each arrival group (0-indexed)
// 4=Date, 5=Flight, 6=Time, 7=Vehicle
const ARR_MERGE_COLS = [4, 5, 6, 7];
// Columns to merge vertically within each departure group
// 4=Date, 5=Flight, 6=Time, 7=Vehicle, 8=Hotel Pickup
const DEP_MERGE_COLS = [4, 5, 6, 7, 8];

function buildArrivalsSheet(
  travelers: TravelerEntry[],
  airport:   string,
  hotel:     string,
): ReturnType<typeof XLSXStyle.utils.aoa_to_sheet> {
  const rows: unknown[][] = [];
  // row 0 = title, row 1 = headers → data starts at row 2
  let rowIdx = 2;
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: ARR_COLS - 1 } }, // title merge
  ];

  // Title — rich text: "From [RED airport] to [RED hotel]"
  rows.push([
    titleCell(airport, hotel),
    ...Array(ARR_COLS - 1).fill(cell('', S_TITLE)),
  ]);

  // Headers
  rows.push([
    cell('Nr',                                  S_HEADER),
    cell('NAME',                                S_HEADER),
    cell('Last Name',                           S_HEADER),
    cell('Cell number',                         S_HEADER),
    cell('Arrival Date',                        S_HEADER),
    cell('Arrival airline flight number',       S_HEADER),
    cell('Arrival Time',                        S_HEADER),
    cell('Vehicle Information',                 S_HEADER),
    cell('Type',                                S_HEADER),
  ]);

  const groups = groupArrivals(travelers);
  for (const group of groups) {
    const vehicle  = vehicleForCount(group.members.length);
    const count    = group.members.length;

    // Separator row (dark navy)
    rows.push(blankRow(ARR_COLS));
    rowIdx++; // separator occupies one row

    const groupStartRow = rowIdx;

    group.members.forEach((t, idx) => {
      const isFirst = idx === 0;
      const s       = isFirst ? S_DATA_FIRST : S_DATA;
      rows.push([
        cell(idx + 1,             s),
        cell(t.firstName,         s),
        cell(t.lastName,          s),
        cell(t.phone,             s),
        cell(isFirst ? t.arrivalDate   : '', s),
        cell(isFirst ? t.arrivalFlight : '', s),
        cell(isFirst ? t.arrivalTime   : '', s),
        cell(isFirst ? vehicle         : '', s),
        cell(t.type,              s),
      ]);
      rowIdx++;
    });

    // Add vertical merges for shared columns when group has 2+ travelers
    if (count > 1) {
      for (const col of ARR_MERGE_COLS) {
        merges.push({
          s: { r: groupStartRow,           c: col },
          e: { r: groupStartRow + count - 1, c: col },
        });
      }
    }
  }

  const ws = XLSXStyle.utils.aoa_to_sheet(rows);
  ws['!merges'] = merges;
  ws['!rows']   = [{ hpt: 36 }]; // title row height (pt) — accommodates sz:20
  ws['!cols']   = [
    { wch: 4 },   // Nr
    { wch: 16 },  // First Name
    { wch: 16 },  // Last Name
    { wch: 16 },  // Phone
    { wch: 18 },  // Date
    { wch: 26 },  // Flight
    { wch: 12 },  // Time
    { wch: 14 },  // Vehicle
    { wch: 12 },  // Type
  ];
  return ws;
}

function buildDeparturesSheet(
  travelers: TravelerEntry[],
  hotel:     string,
  airport:   string,
): ReturnType<typeof XLSXStyle.utils.aoa_to_sheet> {
  const rows: unknown[][] = [];
  let rowIdx = 2;
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: DEP_COLS - 1 } }, // title merge
  ];

  // Title — rich text: "From [RED hotel] to [RED airport]"
  rows.push([
    titleCell(hotel, airport),
    ...Array(DEP_COLS - 1).fill(cell('', S_TITLE)),
  ]);

  // Headers
  rows.push([
    cell('Nr',                                  S_HEADER),
    cell('NAME',                                S_HEADER),
    cell('Last Name',                           S_HEADER),
    cell('Cell number',                         S_HEADER),
    cell('Departure Date',                      S_HEADER),
    cell('Departure airline flight number',     S_HEADER),
    cell('Departure Time',                      S_HEADER),
    cell('Vehicle Information',                 S_HEADER),
    cell('Hotel Departure Time',                S_HEADER),
  ]);

  const groups = groupDepartures(travelers);
  for (const group of groups) {
    const vehicle = vehicleForCount(group.members.length);
    const count   = group.members.length;

    // Separator
    rows.push(blankRow(DEP_COLS));
    rowIdx++;

    const groupStartRow = rowIdx;

    group.members.forEach((t, idx) => {
      const isFirst = idx === 0;
      const s       = isFirst ? S_DATA_FIRST : S_DATA;
      rows.push([
        cell(idx + 1,               s),
        cell(t.firstName,           s),
        cell(t.lastName,            s),
        cell(t.phone,               s),
        cell(isFirst ? t.departureDate   : '', s),
        cell(isFirst ? t.departureFlight : '', s),
        cell(isFirst ? t.departureTime   : '', s),
        cell(isFirst ? vehicle           : '', s),
        cell(isFirst ? (group.pickup || t.departurePickup) : '', s),
      ]);
      rowIdx++;
    });

    if (count > 1) {
      for (const col of DEP_MERGE_COLS) {
        merges.push({
          s: { r: groupStartRow,           c: col },
          e: { r: groupStartRow + count - 1, c: col },
        });
      }
    }
  }

  const ws = XLSXStyle.utils.aoa_to_sheet(rows);
  ws['!merges'] = merges;
  ws['!rows']   = [{ hpt: 36 }]; // title row height
  ws['!cols']   = [
    { wch: 4 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 26 },
    { wch: 12 },
    { wch: 14 },
    { wch: 20 },
  ];
  return ws;
}

// ─── main export function ──────────────────────────────────────────────────

export function transferListFilename(setup: TransferSetup): string {
  const code  = (setup.eventCode  || 'CODE').replace(/\s+/g, '');
  const city  = (setup.eventCity  || 'City').replace(/\s+/g, '-');
  const dates = (setup.eventDates || '').replace(/[\/\\]/g, '-').replace(/\s+/g, '-') || 'Date';
  return `${code}_${city}_${dates}_Transfer_List.xlsx`;
}

export function buildTransferListWorkbook(travelers: TravelerEntry[], setup: TransferSetup) {
  const wb = XLSXStyle.utils.book_new();

  const arrSheet = buildArrivalsSheet(travelers, setup.arrivalAirport, setup.hotel);
  const depSheet = buildDeparturesSheet(travelers, setup.hotel, setup.departureAirport || setup.arrivalAirport);

  XLSXStyle.utils.book_append_sheet(wb, arrSheet, 'Arrivals');
  XLSXStyle.utils.book_append_sheet(wb, depSheet, 'Departures');

  return wb;
}

export function transferListToArrayBuffer(travelers: TravelerEntry[], setup: TransferSetup): ArrayBuffer {
  const wb = buildTransferListWorkbook(travelers, setup);
  return XLSXStyle.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export function exportTransferList(travelers: TravelerEntry[], setup: TransferSetup): void {
  XLSXStyle.writeFile(buildTransferListWorkbook(travelers, setup), transferListFilename(setup));
}
