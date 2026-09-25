/** Deterministic, consistent color per person (by email) — same hash-to-
 * palette shape as calendarDates.ts's eventColorIndex/EVENT_BAR_PALETTE,
 * but keyed by person identity rather than event code, since the Calendar
 * page's Month/People views and the EventDetail team picker all need the
 * same person to render in the same color everywhere. Palette hues reuse
 * colors already established elsewhere in the app (accent/award/generator
 * card colors/danger) rather than inventing a new one. */

export interface PersonColorSet {
  tintBg: string;
  tintText: string;
  solid: string;
}

export const PERSON_PALETTE: PersonColorSet[] = [
  { tintBg: '#e6f4f1', tintText: '#0b6a5b', solid: '#0f7d69' }, // teal (--eo-accent)
  { tintBg: '#e9f7ee', tintText: '#1e6f43', solid: '#2f9e5f' }, // green (--eo-award)
  { tintBg: '#eff6ff', tintText: '#1e40af', solid: '#1d4ed8' }, // blue
  { tintBg: '#f5f3ff', tintText: '#5b21b6', solid: '#7c3aed' }, // purple
  { tintBg: '#fef3c7', tintText: '#92400e', solid: '#d97706' }, // amber
  { tintBg: '#fee2e2', tintText: '#7f1d1d', solid: '#b91c1c' }, // rose
  { tintBg: '#f1f5f9', tintText: '#1e293b', solid: '#475569' }, // slate
  { tintBg: '#e6ebec', tintText: '#0f172a', solid: '#093a33' }, // dark navy
];

export function personColorIndex(emailOrId: string): number {
  const key = emailOrId.trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % PERSON_PALETTE.length;
  return h;
}

export function getPersonColor(emailOrId: string): PersonColorSet {
  return PERSON_PALETTE[personColorIndex(emailOrId)];
}
