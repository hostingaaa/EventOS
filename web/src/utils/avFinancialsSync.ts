import type { AVItemState, AVSetup } from './avEquipment';
import { buildAVLines } from './avEquipment';
import type { DesiredCostLine } from './generatorFinancialsSync';

/** One Financials cost line per line on the equipment list (same description and quantity). */
export function buildAVCostLines(setup: AVSetup, items: AVItemState[]): DesiredCostLine[] {
  return buildAVLines(setup, items).map((line) => ({
    tag: `av-equipment:${line.id}`,
    category: 'AV Equipment',
    description: line.description,
    quantity: line.amt,
  }));
}
