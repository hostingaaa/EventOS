/**
 * Generates a styled Excel (.xlsx) Service Report matching the LEM quote
 * template:
 *  - Title row:      background #17365D (dark navy), white bold text, 2-line
 *  - Header row:     background #D8D8D8 (light gray), bold black text
 *  - Section row:    background #17365D (dark navy), white bold text, merged A:G
 *  - Data rows:      white background, bordered
 *  - Footer rows:    "<Category> Total" per included category + grand
 *                     "Total Sum" — merged A:F, value in G
 */
import XLSXStyle from 'xlsx-js-style';
import type { ServiceReportSetup, ServiceReportCategoryState } from '../pages/ServiceReportPage';

// ─── Style helpers (identical to exportAVEquipment.ts) ─────────────────────

type CS = Record<string, unknown>;

const BLACK = '000000';
const NAVY  = '17365D';
const GRAY  = 'D8D8D8';
const WHITE = 'FFFFFF';

const THIN = { style: 'thin', color: { rgb: BLACK } };
const MED  = { style: 'medium', color: { rgb: BLACK } };
const allBorders = (b: unknown) => ({ top: b, bottom: b, left: b, right: b });

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

export function serviceReportFilename(setup: ServiceReportSetup): string {
  const safeName = [
    setup.eventCode || 'EVENT',
    setup.eventCity || 'City',
    setup.eventDate || 'Date',
  ].join('_').replace(/[/\\:*?"<>|]/g, '-');
  return `${safeName}_Service_Report.xlsx`;
}

export function buildServiceReportWorkbook(
  setup: ServiceReportSetup,
  categories: ServiceReportCategoryState[],
) {
  const included = categories.filter((cat) => cat.enabled && cat.lines.length > 0);

  const titleText = `${setup.reportTitle || setup.eventCode || 'EVENT'}\nLEM: ${setup.lemName || '—'}`;

  const colWidths = [4, 60, 8, 6, 8, 16, 14];

  const ws: Record<string, unknown> = {};
  const enc = XLSXStyle.utils.encode_cell;

  let R = 0;
  let num = 0;
  const rowHeights: { hpt: number }[] = [];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

  ws[enc({ r: R, c: 0 })] = c(titleText, S_TITLE);
  for (let col = 1; col <= 6; col++) ws[enc({ r: R, c: col })] = blank(S_TITLE);
  merges.push({ s: { r: R, c: 0 }, e: { r: R, c: 6 } });
  rowHeights.push({ hpt: 50 });
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

  function writeItemRow(desc: string, item: string, day: number, amount: number, price: number) {
    num++;
    const total = day * amount * price;
    ws[enc({ r: R, c: 0 })] = c(num,   S_NUM);
    ws[enc({ r: R, c: 1 })] = c(desc,  S_DESC);
    ws[enc({ r: R, c: 2 })] = c(item,  S_CELL);
    ws[enc({ r: R, c: 3 })] = c(day,   S_CELL);
    ws[enc({ r: R, c: 4 })] = c(amount, S_CELL);
    ws[enc({ r: R, c: 5 })] = c(price, S_CELL);
    ws[enc({ r: R, c: 6 })] = c(total, S_CELL);
    rowHeights.push({ hpt: 40 });
    R++;
    return total;
  }

  function writeFooterRow(label: string, total: number) {
    ws[enc({ r: R, c: 0 })] = c(label, S_FOOTER_LABEL);
    for (let col = 1; col <= 5; col++) ws[enc({ r: R, c: col })] = blank(S_FOOTER_LABEL);
    ws[enc({ r: R, c: 6 })] = c(total, S_FOOTER_VALUE);
    merges.push({ s: { r: R, c: 0 }, e: { r: R, c: 5 } });
    rowHeights.push({ hpt: 20 });
    R++;
  }

  let grandTotal = 0;

  if (included.length > 0) {
    included.forEach((cat) => {
      writeSectionHeader(cat.name);
      let categoryTotal = 0;
      cat.lines.forEach((line) => {
        categoryTotal += writeItemRow(line.description, line.itemType || 'Item', line.day, line.amount, line.price);
      });
      writeFooterRow(`${cat.name} Total`, categoryTotal);
      grandTotal += categoryTotal;
    });
  }

  writeFooterRow('Total Sum (*Taxes and fees Included)', grandTotal);

  const lastRow = R - 1;
  ws['!ref'] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: 6 } });
  ws['!merges'] = merges;
  ws['!cols'] = colWidths.map((w) => ({ wch: w }));
  ws['!rows'] = rowHeights;

  const wb = XLSXStyle.utils.book_new();
  const sheetName = setup.eventDate || 'Service Report';
  XLSXStyle.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return wb;
}

export function serviceReportToArrayBuffer(
  setup: ServiceReportSetup,
  categories: ServiceReportCategoryState[],
): ArrayBuffer {
  const wb = buildServiceReportWorkbook(setup, categories);
  return XLSXStyle.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export function exportServiceReport(
  setup: ServiceReportSetup,
  categories: ServiceReportCategoryState[],
): void {
  XLSXStyle.writeFile(buildServiceReportWorkbook(setup, categories), serviceReportFilename(setup));
}
