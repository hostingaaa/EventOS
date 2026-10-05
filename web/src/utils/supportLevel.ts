export type SupportLevel = 'full' | 'minimal' | '';

/** The sheet column is hand-editable, so accept "min"/"Minimum"/"Full" etc. */
export function normalizeSupportLevel(raw: string | undefined): SupportLevel {
  const v = (raw || '').trim().toLowerCase();
  if (v.startsWith('full')) return 'full';
  if (v.startsWith('min')) return 'minimal';
  return '';
}
