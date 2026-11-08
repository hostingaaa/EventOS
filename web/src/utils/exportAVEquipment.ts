/**
 * Generates a styled Excel (.xlsx) AV Equipment List matching the PSA template:
 *  - Title row:      background #17365D (dark navy), white bold text, 2-line
 *  - Header row:     background #D8D8D8 (light gray), bold black text
 *  - Section row:    background #17365D (dark navy), white bold text, merged A:G
 *  - Data rows:      white background, bordered
 *  - Footer rows:    "Equipment Total" + "Total Sum" — merged A:F, value in G
 */
import XLSXStyle from 'xlsx-js-style';
import type { AVSetup, AVItemState } from '../pages/AVEquipmentPage';
import { buildDescription } from '../pages/AVEquipmentPage';

// ─── Style helpers ──────────────────────────────────────────────────────────

type CS = Record<string, unknown>;

const BLACK   = '000000';
const NAVY    = '17365D';
const GRAY    = 'D8D8D8';
const WHITE   = 'FFFFFF';

const THIN  = { style: 'thin',   color: { rgb: BLACK } };
const MED   = { style: 'medium', color: { rgb: BLACK } };
const allBorders  = (b: unknown) => ({ top: b, bottom: b, left: b, right: b });

const S_TITLE: CS = {
  fill:      { patternType: 'solid', fgColor: { rgb: NAVY } },
  font:      { bold: true, sz: 14, color: { rgb: WHITE }, name: 'Calibri' },
  alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
  border:    allBorders(MED),
};

const S_HEADER: CS = {
  fill:      { patternType: 'solid', fgColor: { rgb: GRAY } },
  font:      { bold: true, sz: 11, color: { rgb: BLACK }, name: 'Calibri' },
  alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
  border:    allBorders(THIN),
};

const S_SECTION: CS = {
  fill:      { patternType: 'solid', fgColor: { rgb: NAVY } },
  font:      { bold: true, sz: 11, color: { rgb: WHITE }, name: 'Calibri' },
  alignment: { vertical: 'center', horizontal: 'center' },
  border:    allBorders(THIN),
};

const S_NUM: CS = {
  fill:      { patternType: 'solid', fgColor: { rgb: WHITE } },
  font:      { bold: false, sz: 11, color: { rgb: BLACK }, name: 'Calibri' },
  alignment: { vertical: 'center', horizontal: 'center' },
  border:    allBorders(THIN),
};

const S_DESC: CS = {
  fill:      { patternType: 'solid', fgColor: { rgb: WHITE } },
  font:      { bold: false, sz: 11, color: { rgb: BLACK }, name: 'Calibri' },
  alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
  border:    allBorders(THIN),
};

const S_CELL: CS = {
  fill:      { patternType: 'solid', fgColor: { rgb: WHITE } },
  font:      { bold: false, sz: 11, color: { rgb: BLACK }, name: 'Calibri' },
  alignment: { vertical: 'center', horizontal: 'center' },
  border:    allBorders(THIN),
};

const S_FOOTER_LABEL: CS = {
  fill:      { patternType: 'solid', fgColor: { rgb: GRAY } },
  font:      { bold: true, sz: 11, color: { rgb: BLACK }, name: 'Calibri' },
  alignment: { vertical: 'center', horizontal: 'right' },
  border:    allBorders(THIN),
};

const S_FOOTER_VALUE: CS = {
  fill:      { patternType: 'solid', fgColor: { rgb: WHITE } },
  font:      { bold: true, sz: 11, color: { rgb: BLACK }, name: 'Calibri' },
  alignment: { vertical: 'center', horizontal: 'center' },
  border:    allBorders(MED),
};

function c(v: unknown, s: CS) { return { v, s }; }
function blank(s: CS) { return { v: '', s }; }

// ─── Main export ─────────────────────────────────────────────────────────────

export function avEquipmentFilename(setup: AVSetup): string {
  const safeName = [
    setup.eventCode || 'EVENT',
    setup.eventCity || 'City',
    setup.eventDate || 'Date',
  ].join('_').replace(/[/\\:*?"<>|]/g, '-');
  return `${safeName}_Equipment.xlsx`;
}

export interface PsaRow {
  desc:   string;
  day:    number;
  amount: number;
}

export interface PsaSection {
  /** Navy section header, e.g. "Conference Equipment". */
  title:      string;
  /** Footer row shown once all sections are listed, e.g. "Equipment Total". */
  totalLabel: string;
  rows:       PsaRow[];
}

/**
 * The PSA-template sheet shared by the AV Equipment and Supplies & Materials generators:
 * navy title, grey column headers, a navy header per section, numbered rows continuing across
 * sections, then a total row per section and a grand "Total Sum".
 */
export function buildPsaWorkbook(titleLines: string[], sections: PsaSection[], sheetName: string) {
  const colWidths = [4, 60, 8, 6, 8, 16, 14];

  const ws: Record<string, unknown> = {};
  const enc = XLSXStyle.utils.encode_cell;

  let R = 0;
  let num = 0;
  const rowHeights: { hpt: number }[] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  ws[enc({ r: R, c: 0 })] = c(titleLines.join('\n'), S_TITLE);
  for (let col = 1; col <= 6; col++) ws[enc({ r: R, c: col })] = blank(S_TITLE);
  merges.push({ s: { r: R, c: 0 }, e: { r: R, c: 6 } });
  rowHeights.push({ hpt: titleLines.length > 1 ? 50 : 34 });
  R++;

  const headers = ['No.', 'Name of the Service and Brief Description', 'Item', 'Day', 'Amount', 'Price per Item', 'Total'];
  headers.forEach((h, col) => {
    ws[enc({ r: R, c: col })] = c(h, S_HEADER);
  });
  rowHeights.push({ hpt: 32 });
  R++;

  function writeSectionHeader(label: string) {
    ws[enc({ r: R, c: 0 })] = c(label, S_SECTION);
    for (let col = 1; col <= 6; col++) ws[enc({ r: R, c: col })] = blank(S_SECTION);
    merges.push({ s: { r: R, c: 0 }, e: { r: R, c: 6 } });
    rowHeights.push({ hpt: 20 });
    R++;
  }

  function writeItemRow(row: PsaRow) {
    num++;
    ws[enc({ r: R, c: 0 })] = c(num,      S_NUM);
    ws[enc({ r: R, c: 1 })] = c(row.desc, S_DESC);
    ws[enc({ r: R, c: 2 })] = c('Item',   S_CELL);
    ws[enc({ r: R, c: 3 })] = c(row.day,  S_CELL);
    ws[enc({ r: R, c: 4 })] = c(row.amount, S_CELL);
    ws[enc({ r: R, c: 5 })] = c('',       S_CELL);
    ws[enc({ r: R, c: 6 })] = c(0,        S_CELL);
    rowHeights.push({ hpt: 40 });
    R++;
  }

  function writeFooterRow(label: string) {
    ws[enc({ r: R, c: 0 })] = c(label, S_FOOTER_LABEL);
    for (let col = 1; col <= 5; col++) ws[enc({ r: R, c: col })] = blank(S_FOOTER_LABEL);
    ws[enc({ r: R, c: 6 })] = c(0, S_FOOTER_VALUE);
    merges.push({ s: { r: R, c: 0 }, e: { r: R, c: 5 } });
    rowHeights.push({ hpt: 20 });
    R++;
  }

  const filled = sections.filter((section) => section.rows.length > 0);
  filled.forEach((section) => {
    writeSectionHeader(section.title);
    section.rows.forEach(writeItemRow);
  });
  filled.forEach((section) => writeFooterRow(section.totalLabel));
  writeFooterRow('Total Sum (*Taxes and fees Included)');

  const lastRow = R - 1;
  ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: 6 } });
  ws['!merges'] = merges;
  ws['!cols'] = colWidths.map((w) => ({ wch: w }));
  ws['!rows'] = rowHeights;

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return wb;
}

export function buildAVEquipmentWorkbook(setup: AVSetup, items: AVItemState[]) {
  const enabled = items.filter((it) => it.enabled);
  return buildPsaWorkbook(
    [
      `${setup.eventCode} - ${setup.eventCity} - Date: ${setup.eventDate}`,
      `Set up: ${setup.setupStyle}${setup.pax ? ` - ${setup.pax} PAX` : ''}`,
    ],
    [
      {
        title: 'Conference Equipment',
        totalLabel: 'Equipment Total',
        rows: enabled.map((item) => ({ desc: buildDescription(item), day: setup.days, amount: resolveAmount(item) })),
      },
    ],
    setup.eventDate || 'Equipment',
  );
}

export function avEquipmentToArrayBuffer(setup: AVSetup, items: AVItemState[]): ArrayBuffer {
  return XLSXStyle.write(buildAVEquipmentWorkbook(setup, items), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export function exportAVEquipment(setup: AVSetup, items: AVItemState[]): void {
  XLSXStyle.writeFile(buildAVEquipmentWorkbook(setup, items), avEquipmentFilename(setup));
}

// ─── Resolve the "Amount" column value for an item ──────────────────────────

function resolveAmount(item: AVItemState): number {
  switch (item.id) {
    case 'sound':        return 1;
    case 'lcd':          return item.amount ?? 1;
    case 'screen':       return item.amount ?? 1;
    case 'laptop':       return item.amount ?? 1;
    case 'feedback':     return item.amount ?? 1;
    case 'printer':      return item.amount ?? 1;
    case 'mic-fixed':    return item.amount ?? 10;
    case 'mic-head':     return item.amount ?? 1;
    case 'podium':       return 1;
    case 'mic-wireless': return (item.lapel ?? 0) + (item.handheld ?? 0);
    case 'internet':     return item.amount ?? 1;
    case 'camera':       return item.amount ?? 1;
    case 'interp':       return item.booths ?? 1;
    default:             return 1;
  }
}
