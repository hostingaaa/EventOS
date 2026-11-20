/**
 * AV Equipment List — the item catalogue, PAX-based auto rules, the setup suggestion, and the rows written to
 * the PSA sheet. Shared by the generator page, the .xlsx export and the Financials sync, so all three agree.
 *
 * Item ids are the ones saved lists and Financials cost lines (`av-equipment:<id>`) already use — keep them.
 */
import { parseToIsoDate } from './dateFormat';

export interface AVSetup {
  eventCode:  string;
  eventRowId: string;
  eventCity:  string;
  eventDate:  string;
  /** "Dec02" — the event's start day, for the file name. Empty when the date was typed by hand. */
  fileDay?:   string;
  setupStyle: string;
  pax:        string;
  days:       number;
}

export interface AVItemState {
  id:          string;
  enabled:     boolean;
  amount?:     number;
  /** LCD projector lumens; 0 / missing = auto by PAX. */
  luminosity?: number;
  /** Projector or LED screen size; '' / missing = auto by PAX. */
  screenSize?: string;
  /** Wireless mics. */
  lapel?:      number;
  handheld?:   number;
  /** Simultaneous interpretation. */
  receivers?:  number;
  booths?:     number;
  /** Dedicated internet. */
  bandwidth?:  string;
}

export type AVItemKind = 'qty' | 'lumens' | 'screen' | 'fixed' | 'wireless' | 'net' | 'si';

export interface AVItemDef {
  id:    string;
  name:  string;
  kind:  AVItemKind;
  /** Quantity dropdown upper bound (lower bound is 1). */
  max?:  number;
  sizes?: string[];
  sizeLabel?: string;
  autoSize?: (pax: number) => string;
}

export const SETUP_STYLES = ['Classroom', 'Cabaret', 'Theatre', 'U-Shape', 'Boardroom'];
export const LUMENS = [3000, 4000, 5000, 6000, 8000];
export const SCREEN_SIZES = ['2.0 × 1.5 m', '2.4 × 1.8 m', '3.0 × 2.25 m', '4.0 × 3.0 m', '5.0 × 3.75 m'];
export const LED_SIZES = ['3.0 × 2.0 m', '4.0 × 2.5 m', '5.0 × 3.0 m', '6.0 × 3.5 m', '8.0 × 4.5 m'];
export const BANDWIDTHS = ['50 Mbps', '100 Mbps', '200 Mbps', '500 Mbps'];
export const DEFAULT_BANDWIDTH = '100 Mbps';
export const MAX_DAYS = 14;

export const autoLumens = (pax: number) => (pax <= 50 ? 3000 : pax <= 100 ? 4000 : pax <= 200 ? 5000 : pax <= 350 ? 6000 : 8000);
export const autoScreen = (pax: number) => SCREEN_SIZES[pax <= 40 ? 0 : pax <= 80 ? 1 : pax <= 150 ? 2 : pax <= 300 ? 3 : 4];
export const autoLed = (pax: number) => LED_SIZES[pax <= 50 ? 0 : pax <= 100 ? 1 : pax <= 200 ? 2 : pax <= 350 ? 3 : 4];

export const AV_ITEMS: AVItemDef[] = [
  { id: 'sound',        name: 'Sound system', kind: 'qty' },
  { id: 'lcd',          name: 'LCD projector', kind: 'lumens', max: 10 },
  { id: 'screen',       name: 'Projector screen', kind: 'screen', max: 10, sizes: SCREEN_SIZES, sizeLabel: 'Screen size', autoSize: autoScreen },
  { id: 'led',          name: 'LED screen', kind: 'screen', max: 6, sizes: LED_SIZES, sizeLabel: 'LED screen size', autoSize: autoLed },
  { id: 'laptop',       name: 'Laptop', kind: 'qty' },
  { id: 'feedback',     name: 'Feedback monitor', kind: 'qty' },
  { id: 'printer',      name: 'Printer', kind: 'qty' },
  { id: 'mic-fixed',    name: 'Fixed tabletop microphone', kind: 'qty', max: 200 },
  { id: 'mic-head',     name: 'Tabletop microphone — head table', kind: 'qty', max: 30 },
  { id: 'podium',       name: 'Podium with a mic', kind: 'fixed' },
  { id: 'mic-wireless', name: 'Wireless, portable & lapel microphones', kind: 'wireless' },
  { id: 'internet',     name: 'Dedicated internet connection', kind: 'net' },
  { id: 'camera',       name: 'HD camera', kind: 'qty' },
  { id: 'interp',       name: 'Simultaneous interpretation', kind: 'si' },
];

const DEF_BY_ID = new Map(AV_ITEMS.map((d) => [d.id, d]));

export const range = (from: number, to: number, step = 1): number[] => {
  const out: number[] = [];
  for (let n = from; n <= to; n += step) out.push(n);
  return out;
};
export const qtyOptions = (def: AVItemDef) => range(1, def.max ?? 20);
export const MIC_OPTIONS = range(0, 30);
export const BOOTH_OPTIONS = range(1, 8);
export const RECEIVER_OPTIONS = range(10, 1000, 10);

export function paxNumber(pax: string | number | undefined): number {
  const n = parseInt(String(pax ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function blankItem(def: AVItemDef): AVItemState {
  switch (def.kind) {
    case 'wireless': return { id: def.id, enabled: false, lapel: 0, handheld: 0 };
    case 'si':       return { id: def.id, enabled: false, receivers: 10, booths: 1 };
    case 'net':      return { id: def.id, enabled: false, bandwidth: DEFAULT_BANDWIDTH };
    case 'lumens':   return { id: def.id, enabled: false, amount: 1, luminosity: 0 };
    case 'screen':   return { id: def.id, enabled: false, amount: 1, screenSize: '' };
    default:         return { id: def.id, enabled: false, amount: 1 };
  }
}

export function blankItems(): AVItemState[] {
  return AV_ITEMS.map(blankItem);
}

/** Saved lists from before an item existed (or with an old shape) → one state per catalogue item, in order. */
export function normalizeItems(saved: AVItemState[] | undefined): AVItemState[] {
  const byId = new Map((saved ?? []).map((it) => [it.id, it]));
  return AV_ITEMS.map((def) => ({ ...blankItem(def), ...(byId.get(def.id) ?? {}) }));
}

export interface ResolvedItem {
  /** Projector lumens, screen size or bandwidth after auto rules ('' when the item has none). */
  option: string;
  qty: number;
}

export function resolveItem(item: AVItemState, pax: number): ResolvedItem {
  const def = DEF_BY_ID.get(item.id);
  const lapel = item.lapel ?? 0;
  const handheld = item.handheld ?? 0;
  switch (def?.kind) {
    case 'lumens':   return { option: String(item.luminosity || autoLumens(pax)), qty: item.amount ?? 1 };
    case 'screen':   return { option: item.screenSize || def.autoSize!(pax), qty: item.amount ?? 1 };
    case 'net':      return { option: item.bandwidth || DEFAULT_BANDWIDTH, qty: 1 };
    case 'fixed':    return { option: '', qty: 1 };
    case 'wireless': return { option: '', qty: lapel + handheld };
    case 'si':       return { option: '', qty: item.receivers ?? 10 };
    default:         return { option: '', qty: item.amount ?? 1 };
  }
}

/** Screen sizes are stored as "3.0 × 2.25 m"; lists saved before the redesign hold "2.5 x 3.5" (meters). */
const withUnit = (size: string) => (/m$/.test(size.trim()) ? size.trim() : `${size.trim()} meters`);

/** The text in the "Name of the Service and Brief Description" column (PSA template wording). */
export function buildDescription(item: AVItemState, pax: number): string {
  const { option } = resolveItem(item, pax);
  switch (item.id) {
    case 'sound':
      return 'Sound system in the conference room integrated with A/V and interpretation equipment';
    case 'lcd':
      return `LCD projectors (min ${option} lumin)`;
    case 'screen':
      return `Projector screens (min ${withUnit(option)})`;
    case 'led':
      return `LED screen (min ${withUnit(option)}) with processor and technician`;
    case 'laptop':
      return 'Laptop with internet capability and licensed Microsoft Office Suite, Adobe and with clicker to advance two slides simultaneously';
    case 'feedback':
      return 'Feedback monitor';
    case 'printer':
      return 'Black and white and color printer with scanning and photocopying capabilities';
    case 'mic-fixed':
      return 'Fixed tabletop microphones';
    case 'mic-head':
      return 'Fixed tabletop microphones - Head Table for the speakers';
    case 'podium':
      return 'Podium with a mic';
    case 'mic-wireless':
      return `Number of wireless, portable and lapel microphones: (${item.lapel ?? 0} lapel, ${item.handheld ?? 0} wireless handheld)`;
    case 'internet':
      return `Dedicated internet connection, min ${option} (to support video conference capability for participants unable to attend who wish to join virtually)`;
    case 'camera':
      return 'HD camera & interpretation sound transmitted to the Zoom';
    case 'interp': {
      const b = item.booths ?? 1;
      const r = item.receivers ?? 10;
      return `Simultaneous Interpretation System / ${b} Fully covered interpretation booth${b !== 1 ? 's' : ''} for ${b * 2} interpreters and receivers for up to ${r} people`;
    }
    default:
      return '';
  }
}

export interface AVLine {
  id:          string;
  no:          number;
  description: string;
  day:         number;
  amt:         number;
}

/** One line per ticked item with a quantity above 0, numbered in catalogue order — the preview and the sheet. */
export function buildAVLines(setup: AVSetup, items: AVItemState[]): AVLine[] {
  const pax = paxNumber(setup.pax);
  const byId = new Map(items.map((it) => [it.id, it]));
  const lines: AVLine[] = [];
  for (const def of AV_ITEMS) {
    const item = byId.get(def.id);
    if (!item?.enabled) continue;
    const { qty } = resolveItem(item, pax);
    if (qty <= 0) continue;
    lines.push({ id: def.id, no: lines.length + 1, description: buildDescription(item, pax), day: setup.days, amt: qty });
  }
  return lines;
}

/** Short summary shown at the end of a ticked item's row. */
export function itemSummary(item: AVItemState, pax: number): string {
  if (!item.enabled) return '';
  const def = DEF_BY_ID.get(item.id);
  const { option, qty } = resolveItem(item, pax);
  const booths = item.booths ?? 1;
  switch (def?.kind) {
    case 'wireless': return `${qty} mics`;
    case 'si':       return `${qty} rcv · ${booths} booth${booths === 1 ? '' : 's'}`;
    case 'lumens':   return `×${qty} · ${option} lm`;
    case 'net':      return option;
    default:         return `×${qty}`;
  }
}

const tableMicSetup = (setupStyle: string) => setupStyle === 'Boardroom' || setupStyle === 'U-Shape';

/** The "Apply suggestion" banner text for the current setup and PAX. */
export function suggestionText(setupStyle: string, pax: number): string {
  const who = `${setupStyle} for ${pax || '?'}`;
  return tableMicSetup(setupStyle)
    ? `${who}: sound, projector + screen, laptop, podium, wireless mics and ${Math.ceil(pax / 2)} tabletop mics.`
    : `${who}: sound, projector + screen, laptop, podium, wireless mics and head-table mics.`;
}

/** Ticks a starting set for the setup style; items it doesn't touch keep their state. */
export function applySuggestion(items: AVItemState[], setupStyle: string, paxRaw: number): AVItemState[] {
  const pax = Math.max(1, paxRaw);
  const on = (amount: number, extra: Partial<AVItemState> = {}): Partial<AVItemState> => ({ enabled: true, amount, ...extra });
  const patch: Record<string, Partial<AVItemState>> = {
    sound: on(1),
    lcd: on(pax > 200 ? 2 : 1),
    screen: on(pax > 200 ? 2 : 1),
    laptop: on(1),
    podium: on(1),
    'mic-wireless': { enabled: true, handheld: pax > 100 ? 2 : 1, lapel: 2 },
  };
  if (tableMicSetup(setupStyle)) patch['mic-fixed'] = on(Math.min(200, Math.ceil(pax / 2)));
  else patch['mic-head'] = on(4);
  if (setupStyle === 'Theatre' || setupStyle === 'Classroom') patch.feedback = on(1);
  return items.map((it) => (patch[it.id] ? { ...it, ...patch[it.id] } : it));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO yyyy-MM-dd → "Dec02". */
export function fileDayFromIso(iso: string | undefined): string {
  const m = (iso ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${MONTHS[parseInt(m[2], 10) - 1] ?? ''}${m[3]}`;
}

/** "Dec02" from the event's start day; for a typed date, the first date in it, else the text without spaces. */
export function avFileDay(setup: Pick<AVSetup, 'fileDay' | 'eventDate'>): string {
  if (setup.fileDay) return setup.fileDay;
  const date = (setup.eventDate || '').trim();
  const iso = parseToIsoDate(date) ?? parseLooseDate(date);
  return fileDayFromIso(iso ?? '') || date.replace(/\s+/g, '') || 'Date';
}

/** "2 Dec 2026", "3–4 Dec 2026" → ISO of the first day. */
function parseLooseDate(text: string): string | null {
  const m = text.match(/^(\d{1,2})(?:\s*[–-]\s*\d{1,2})?\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS.findIndex((x) => x.toLowerCase() === m[2].toLowerCase());
  if (month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** `{code}_{city without country}_{fileDay}_Equipment.xlsx`, e.g. `J234_Kurumba_Dec02_Equipment.xlsx`. */
export function avEquipmentFilename(setup: Pick<AVSetup, 'eventCode' | 'eventCity' | 'eventDate' | 'fileDay'>): string {
  const city = (setup.eventCity.split(',')[0] || '').trim().replace(/\s+/g, '') || 'City';
  const name = [setup.eventCode.trim() || 'EVENT', city, avFileDay(setup)].join('_').replace(/[/\\:*?"<>|]/g, '-');
  return `${name}_Equipment.xlsx`;
}

export function avTitleLines(setup: AVSetup): [string, string] {
  const pax = paxNumber(setup.pax);
  const d = setup.days;
  return [
    `${setup.eventCode || 'EVENT'} — ${setup.eventCity || 'City'} — Date: ${setup.eventDate || '—'}`,
    `Set up: ${setup.setupStyle} · ${pax} PAX · ${d} day${d === 1 ? '' : 's'}`,
  ];
}

/** Date text for the editable Date field: "2 Dec 2026", "3–4 Dec 2026", "30 Nov – 2 Dec 2026". */
export function avDateLabel(startIso: string | undefined, endIso: string | undefined): string {
  const s = (startIso ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return '';
  const e = /^\d{4}-\d{2}-\d{2}/.test((endIso ?? '').trim()) ? endIso!.trim() : s;
  const [sy, sm, sd] = s.slice(0, 10).split('-').map(Number);
  const [ey, em, ed] = e.slice(0, 10).split('-').map(Number);
  if (s.slice(0, 10) >= e.slice(0, 10)) return `${sd} ${MONTHS[sm - 1]} ${sy}`;
  if (sy === ey && sm === em) return `${sd}–${ed} ${MONTHS[em - 1]} ${ey}`;
  if (sy === ey) return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey}`;
  return `${sd} ${MONTHS[sm - 1]} ${sy} – ${ed} ${MONTHS[em - 1]} ${ey}`;
}

/** The event row's free-text capacity ("120 pax", "Full") → a PAX number when it has one. */
export function paxFromCapacity(capacity: string | undefined): string {
  const m = (capacity ?? '').match(/\d+/);
  return m ? m[0] : '';
}
