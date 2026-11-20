/** File naming shared by the QR Code generator and the Generators page card. */

export function qrFilenameSlug(s: string): string {
  return s.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || 'qr-code';
}

/** The label the QR generator pre-fills when an event is picked. */
export function qrDefaultLabel(eventCode: string): string {
  return eventCode ? `${eventCode} — Registration` : '';
}
