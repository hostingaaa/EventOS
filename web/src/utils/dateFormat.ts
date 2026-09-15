/** Display format for dates in forms and UI. Internal storage stays ISO (yyyy-MM-dd). */

export const DATE_INPUT_PLACEHOLDER = 'dd-MM-yyyy';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_RE = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isValidIsoDate(iso: string): boolean {
  const m = iso.match(ISO_RE);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(`${iso}T12:00:00`);
  return (
    !isNaN(dt.getTime()) &&
    dt.getFullYear() === y &&
    dt.getMonth() + 1 === mo &&
    dt.getDate() === d
  );
}

/** ISO yyyy-MM-dd → display with a written month, e.g. "15 Jun 2026" */
export function formatIsoDate(iso: string | undefined): string {
  if (!iso?.trim()) return '';
  const t = iso.trim();
  const d = new Date(t.includes('T') ? t : `${t}T12:00:00`);
  if (isNaN(d.getTime())) return t;
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

/** dd-MM-yyyy (or yyyy-MM-dd) → ISO yyyy-MM-dd */
export function parseToIsoDate(input: string): string | null {
  const t = input.trim();
  if (!t) return null;

  const display = t.match(DISPLAY_RE);
  if (display) {
    const iso = `${display[3]}-${pad2(Number(display[2]))}-${pad2(Number(display[1]))}`;
    return isValidIsoDate(iso) ? iso : null;
  }

  if (ISO_RE.test(t) && isValidIsoDate(t)) return t;

  const d = new Date(t.includes('T') ? t : `${t}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return isValidIsoDate(iso) ? iso : null;
}

/** Event date range label stored on the sheet, e.g. 15 Jun 2026 – 17 Jun 2026 */
export function formatDateRange(startIso: string, endIso: string): string {
  if (!startIso) return '';
  const start = formatIsoDate(startIso);
  if (!endIso || endIso === startIso) return start;
  return `${start} – ${formatIsoDate(endIso)}`;
}

/** Format a set of picked program dates: a range if contiguous, else a comma list. */
export function formatProgramDates(isoDates: string[]): string {
  const sorted = Array.from(new Set(isoDates.filter(Boolean))).sort();
  if (sorted.length === 0) return '';
  if (sorted.length === 1) return formatIsoDate(sorted[0]);

  const contiguous = sorted.every((iso, i) => {
    if (i === 0) return true;
    const prev = new Date(`${sorted[i - 1]}T12:00:00`);
    const cur = new Date(`${iso}T12:00:00`);
    return Math.round((cur.getTime() - prev.getTime()) / 86400000) === 1;
  });

  if (contiguous) return formatDateRange(sorted[0], sorted[sorted.length - 1]);
  return sorted.map(formatIsoDate).join(', ');
}

/** Month grouping label, e.g. June 2026 */
export function formatMonthYear(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
