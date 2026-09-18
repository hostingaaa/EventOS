/**
 * Shared create-or-update (never delete) reconciliation used by generator
 * pages (AV Equipment, Transfer List) to sync their current selection into
 * the event's Financials cost items. Each synced item is tagged via its
 * `notes` field (never rendered in FinancialsPanel) so a later re-sync can
 * find and update it instead of creating a duplicate. Unit rate is never
 * touched by the sync, so a team member's entered rate always survives.
 */
import { fetchAllCostItems, createCostItem, updateCostItem } from '../api/client';

export interface DesiredCostLine {
  tag: string;
  category: string;
  description: string;
  quantity: number;
}

export async function syncGeneratorCostItems(
  eventCode: string,
  eventRowId: string,
  lines: DesiredCostLine[],
  createdBy: string,
): Promise<void> {
  const existing = (await fetchAllCostItems()).filter((c) => c.eventCode === eventCode);
  const byTag = new Map(existing.filter((c) => c.notes).map((c) => [c.notes!, c]));

  for (const line of lines) {
    const match = byTag.get(line.tag);
    if (match) {
      if (match.description !== line.description || match.quantity !== line.quantity) {
        await updateCostItem(match.costItemId, { description: line.description, quantity: line.quantity }, createdBy);
      }
    } else {
      await createCostItem({
        eventCode,
        eventRowId,
        category: line.category,
        description: line.description,
        quantity: line.quantity,
        unitRate: 0,
        currency: 'USD',
        notes: line.tag,
        createdBy,
      });
    }
  }
}
