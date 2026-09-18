import type { AVItemState, SupplyItemState } from '../pages/AVEquipmentPage';
import { buildDescription } from '../pages/AVEquipmentPage';
import { resolvePreviewAmount } from '../pages/AVEquipmentPage';
import type { DesiredCostLine } from './generatorFinancialsSync';

export function buildAVCostLines(items: AVItemState[], supplies: SupplyItemState[]): DesiredCostLine[] {
  const lines: DesiredCostLine[] = [];

  for (const item of items) {
    if (!item.enabled) continue;
    lines.push({
      tag: `av-equipment:${item.id}`,
      category: 'AV Equipment',
      description: buildDescription(item),
      quantity: resolvePreviewAmount(item),
    });
  }

  for (const supply of supplies) {
    lines.push({
      tag: `av-equipment:supply:${supply.id}`,
      category: 'AV Supplies',
      description: supply.name,
      quantity: supply.amount,
    });
  }

  return lines;
}
