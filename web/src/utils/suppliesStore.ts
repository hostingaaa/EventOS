/**
 * Persists a supplies list per event in localStorage (same pattern as avEquipmentStore).
 *
 * Supplies used to be saved inside the AV Equipment record, so an event with no supplies record
 * of its own falls back to whatever it had there — nothing already entered is lost in the move.
 */
import { loadAVEquipment } from './avEquipmentStore';
import type { SuppliesSetup, SupplyItemState } from './supplies';

export interface SavedSupplies {
  setup:        SuppliesSetup;
  supplies:     SupplyItemState[];
  savedAt:      string;
  savedBy:      string;
  savedByEmail: string;
  driveUrl?:    string;
  driveFileId?: string;
}

function key(eventCode: string): string {
  return `supplies-save-${eventCode.trim().toUpperCase()}`;
}

export function saveSupplies(
  eventCode: string,
  data: Omit<SavedSupplies, 'savedAt'> & { savedAt?: string },
): void {
  if (!eventCode.trim()) return;
  const record: SavedSupplies = { ...data, savedAt: data.savedAt ?? new Date().toISOString() };
  localStorage.setItem(key(eventCode), JSON.stringify(record));
}

export function loadSupplies(eventCode: string): SavedSupplies | null {
  if (!eventCode.trim()) return null;
  try {
    const raw = localStorage.getItem(key(eventCode));
    return raw ? (JSON.parse(raw) as SavedSupplies) : null;
  } catch {
    return null;
  }
}

/** Supplies saved on the AV Equipment page before this generator existed (null if none). */
export function loadLegacyAVSupplies(eventCode: string): SupplyItemState[] | null {
  const legacy = loadAVEquipment(eventCode)?.supplies;
  return legacy && legacy.length > 0 ? legacy : null;
}
