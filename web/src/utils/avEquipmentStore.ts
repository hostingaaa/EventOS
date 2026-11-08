/**
 * Persists AV equipment list state per event in localStorage.
 */
import type { AVItemState, AVSetup } from '../pages/AVEquipmentPage';
import type { SupplyItemState } from './supplies';

export interface SavedAVEquipment {
  setup:        AVSetup;
  items:        AVItemState[];
  /** Legacy: supplies now live in suppliesStore. Kept so lists saved here are carried over. */
  supplies?:    SupplyItemState[];
  savedAt:      string;
  savedBy:      string;
  savedByEmail: string;
  driveUrl?:    string;
  driveFileId?: string;
}

function key(eventCode: string): string {
  return `av-save-${eventCode.trim().toUpperCase()}`;
}

export function saveAVEquipment(
  eventCode: string,
  data: Omit<SavedAVEquipment, 'savedAt'> & { savedAt?: string },
): void {
  if (!eventCode.trim()) return;
  const record: SavedAVEquipment = { ...data, savedAt: data.savedAt ?? new Date().toISOString() };
  localStorage.setItem(key(eventCode), JSON.stringify(record));
}

export function loadAVEquipment(eventCode: string): SavedAVEquipment | null {
  if (!eventCode.trim()) return null;
  try {
    const raw = localStorage.getItem(key(eventCode));
    return raw ? (JSON.parse(raw) as SavedAVEquipment) : null;
  } catch {
    return null;
  }
}
