/**
 * Shared bits of the Supplies & Materials generator: item types, the catalog of common
 * supplies, the Excel file name, and the cost lines it syncs into an event's Financials.
 */
import type { DesiredCostLine } from './generatorFinancialsSync';

export interface SupplyItemState {
  id:     string;
  name:   string;
  amount: number;
}

export interface SuppliesSetup {
  eventCode:  string;
  eventRowId: string;
  eventCity:  string;
  eventDate:  string;
}

export const SUPPLY_CATALOG = ['Briefing Folders', 'Table Tent Cards', 'Pen and Notepads', 'Name Badges'];

/** Select value meaning "type your own item name". */
export const CUSTOM_SUPPLY = '__custom__';

export function suppliesFilename(setup: SuppliesSetup): string {
  const safeName = [
    setup.eventCode || 'EVENT',
    setup.eventCity || 'City',
    setup.eventDate || 'Date',
  ].join('_').replace(/[/\\:*?"<>|]/g, '-');
  return `${safeName}_Supplies.xlsx`;
}

/**
 * Financials cost lines for a supplies list. The tags and category are the ones these lines
 * had when supplies lived on the AV Equipment page, so lines already synced for an event are
 * updated in place rather than duplicated, and AV-scoped vendor links keep seeing them.
 */
export function buildSupplyCostLines(supplies: SupplyItemState[]): DesiredCostLine[] {
  return supplies.map((supply) => ({
    tag: `av-equipment:supply:${supply.id}`,
    category: 'AV Supplies',
    description: supply.name,
    quantity: supply.amount,
  }));
}
