/**
 * Excel (.xlsx) for the Supplies & Materials generator — the same PSA template as the AV
 * Equipment list, with a single "Conference Supplies and Materials" section. Supplies are
 * always listed as 1 day.
 */
import XLSXStyle from 'xlsx-js-style';
import { buildPsaWorkbook } from './exportAVEquipment';
import { suppliesFilename, type SuppliesSetup, type SupplyItemState } from './supplies';

export function buildSuppliesWorkbook(setup: SuppliesSetup, supplies: SupplyItemState[]) {
  return buildPsaWorkbook(
    [`${setup.eventCode} - ${setup.eventCity} - Date: ${setup.eventDate}`],
    [
      {
        title: 'Conference Supplies and Materials',
        totalLabel: 'Supplies Total',
        rows: supplies.map((s) => ({ desc: s.name, day: 1, amount: s.amount })),
      },
    ],
    setup.eventDate || 'Supplies',
  );
}

export function suppliesToArrayBuffer(setup: SuppliesSetup, supplies: SupplyItemState[]): ArrayBuffer {
  return XLSXStyle.write(buildSuppliesWorkbook(setup, supplies), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export function exportSupplies(setup: SuppliesSetup, supplies: SupplyItemState[]): void {
  XLSXStyle.writeFile(buildSuppliesWorkbook(setup, supplies), suppliesFilename(setup));
}
