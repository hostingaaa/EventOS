/**
 * The Per Diem form is printed / saved as PDF from the browser, so nothing reaches the backend. To give the
 * Generators page a status for it, the form records the last print per event in this browser.
 */
export interface PerDiemPrintRecord {
  printedAt: string; // ISO timestamp
  printedBy: string;
  traveler: string;
  fileName: string;
}

const key = (eventCode: string) => `perdiem-print-${eventCode.trim().toUpperCase()}`;

export function savePerDiemPrint(eventCode: string, record: PerDiemPrintRecord): void {
  if (!eventCode.trim()) return;
  try {
    localStorage.setItem(key(eventCode), JSON.stringify(record));
  } catch {
    /* storage unavailable — status just stays "Not started" */
  }
}

export function loadPerDiemPrint(eventCode: string): PerDiemPrintRecord | null {
  try {
    const raw = localStorage.getItem(key(eventCode));
    return raw ? (JSON.parse(raw) as PerDiemPrintRecord) : null;
  } catch {
    return null;
  }
}

/** `J401_Baku_PerDiem_Name-Surname` — used as the print title, which browsers offer as the PDF file name. */
export function perDiemFileStem(eventCode: string, city: string, traveler: string): string {
  const part = (s: string, fallback: string) => (s.trim() || fallback).replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, '-');
  return `${part(eventCode, 'EVENT')}_${part(city, 'City')}_PerDiem_${part(traveler, '{traveler}')}`;
}
