import type { TravelerEntry } from '../pages/TransferListPage';
import { computeVehicleCounts } from './exportTransferList';
import type { DesiredCostLine } from './generatorFinancialsSync';

export function buildTransferCostLines(travelers: TravelerEntry[]): DesiredCostLine[] {
  const counts = computeVehicleCounts(travelers);
  return Object.entries(counts).map(([vehicle, count]) => ({
    tag: `transfer:vehicle:${vehicle}`,
    category: 'Transportation',
    description: `${vehicle} transfer`,
    quantity: count,
  }));
}
