/**
 * Persists Service Report state per event in localStorage — mirrors
 * avEquipmentStore.ts exactly.
 */
import type { ServiceReportSetup, ServiceReportCategoryState } from '../pages/ServiceReportPage';

export interface SavedServiceReport {
  setup:        ServiceReportSetup;
  categories:   ServiceReportCategoryState[];
  savedAt:      string;
  savedBy:      string;
  savedByEmail: string;
  driveUrl?:    string;
  driveFileId?: string;
}

function key(eventCode: string): string {
  return `service-report-save-${eventCode.trim().toUpperCase()}`;
}

export function saveServiceReport(
  eventCode: string,
  data: Omit<SavedServiceReport, 'savedAt'> & { savedAt?: string },
): void {
  if (!eventCode.trim()) return;
  const record: SavedServiceReport = { ...data, savedAt: data.savedAt ?? new Date().toISOString() };
  localStorage.setItem(key(eventCode), JSON.stringify(record));
}

export function loadServiceReport(eventCode: string): SavedServiceReport | null {
  if (!eventCode.trim()) return null;
  try {
    const raw = localStorage.getItem(key(eventCode));
    return raw ? (JSON.parse(raw) as SavedServiceReport) : null;
  } catch {
    return null;
  }
}
