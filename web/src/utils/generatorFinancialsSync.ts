/**
 * Shared create-or-update (never delete) reconciliation used by generator
 * pages (AV Equipment, Transfer List, Service Report) to sync their current
 * selection into the event's Financials cost items. Each synced item is
 * tagged via its `notes` field (never rendered in FinancialsPanel) so a
 * later re-sync can find and update it instead of creating a duplicate.
 *
 * `unitRate` is optional: AV Equipment/Transfer List omit it, so a team
 * member's manually-entered real rate in Financials always survives their
 * re-saves. Service Report supplies it, since its own price *is* the
 * authoritative source for that line.
 */
import { fetchAllCostItems, createCostItem, updateCostItem } from '../api/client';

export interface DesiredCostLine {
  tag: string;
  category: string;
  description: string;
  quantity: number;
  unitRate?: number;
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
      const patch: { category?: string; description?: string; quantity?: number; unitRate?: number } = {};
      if (match.category !== line.category) patch.category = line.category;
      if (match.description !== line.description) patch.description = line.description;
      if (match.quantity !== line.quantity) patch.quantity = line.quantity;
      if (line.unitRate !== undefined && match.unitRate !== line.unitRate) patch.unitRate = line.unitRate;
      if (Object.keys(patch).length > 0) {
        await updateCostItem(match.costItemId, patch, createdBy);
      }
    } else {
      await createCostItem({
        eventCode,
        eventRowId,
        category: line.category,
        description: line.description,
        quantity: line.quantity,
        unitRate: line.unitRate ?? 0,
        currency: 'USD',
        notes: line.tag,
        createdBy,
      });
    }
  }
}
