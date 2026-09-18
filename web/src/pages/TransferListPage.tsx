/**
 * Transfer List Generator
 *
 * Builds the PSA airport↔hotel transfer list, groups travelers by flight,
 * auto-assigns vehicles, and exports a styled .xlsx file.
 *
 * Route: /transfer-list  (query params: code, city, dates, hotel, airport)
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { exportTransferList, transferListFilename, transferListToArrayBuffer, vehicleForCount } from '../utils/exportTransferList';
import { saveTransferList, loadTransferList } from '../utils/transferListStore';
import { fetchEvents, saveTransferListToDrive } from '../api/client';
import { parseTicketPdf } from '../utils/parseTicketPdf';
import { buildTransferCostLines } from '../utils/transferFinancialsSync';
import { syncGeneratorCostItems } from '../utils/generatorFinancialsSync';
import { useUser } from '../context/UserContext';
import type { Event } from '../types';
import { DateInput } from '../components/DateInput';
import './TransferListPage.css';

// ─── Types (exported so exportTransferList can import them) ───────────────

export interface TravelerEntry {
  id:                    string;
  firstName:             string;
  lastName:              string;
  phone:                 string;
  type:                  'EXPERT' | 'PARTICIPANT';
  // Arrival
  arrivalDate:           string;
  arrivalFlight:         string;
  arrivalTime:           string;
  // Departure
  departureDate:         string;
  departureFlight:       string;
  departureTime:         string;
  /** Offset in minutes before departure (e.g. 180 = 3 h before) */
  departurePickupOffset: number;
  /** Computed HH:MM pickup time — derived from departureTime − offset */
  departurePickup:       string;
}

// ─── Pickup offset options: 2h30m → 4h30m in 15-min steps ────────────────

export const PICKUP_OFFSETS = Array.from(
  { length: (270 - 150) / 15 + 1 },
  (_, i) => 150 + i * 15,
); // [150, 165, 180, ..., 270]

export function offsetLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h before` : `${h}h ${m}m before`;
}

/** Subtract offsetMins from a "HH:MM" departure time. Returns "HH:MM". */
export function computePickupTime(departureTime: string, offsetMins: number): string {
  if (!departureTime || !offsetMins) return '';
  const [hStr, mStr] = departureTime.split(':');
  const hh = parseInt(hStr, 10);
  const mm = parseInt(mStr, 10);
  if (isNaN(hh) || isNaN(mm)) return '';
  const total = ((hh * 60 + mm - offsetMins) % 1440 + 1440) % 1440;
  const rh = Math.floor(total / 60);
  const rm = total % 60;
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`;
}

export interface TransferSetup {
  eventCode:        string;
  eventRowId:       string;
  eventCity:        string;
  eventDates:       string;
  hotel:            string;
  arrivalAirport:   string;
  departureAirport: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyTraveler(): TravelerEntry {
  return {
    id:                    uid(),
    firstName:             '',
    lastName:              '',
    phone:                 '',
    type:                  'PARTICIPANT',
    arrivalDate:           '',
    arrivalFlight:         '',
    arrivalTime:           '',
    departureDate:         '',
    departureFlight:       '',
    departureTime:         '',
    departurePickupOffset: 0,
    departurePickup:       '',
  };
}

function groupByKey<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(item);
  }
  return m;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function driveMetaFromSaved(saved: { driveUrl?: string; driveFileId?: string }) {
  const driveFileId = saved.driveFileId || driveFileIdFromUrl(saved.driveUrl);
  const driveUrl =
    saved.driveUrl ||
    (driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view?usp=sharing` : null);
  return { driveFileId: driveFileId ?? null, driveUrl };
}

function driveFileIdFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const m = url.match(/\/file\/d\/([^/?#]+)/);
  return m?.[1];
}

const TYPE_BADGE: Record<string, string> = {
  EXPERT:      '#7c3aed',
  PARTICIPANT: '#0369a1',
};

// ─── Sub-components ────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="tl-type-badge"
      style={{ background: TYPE_BADGE[type] ?? '#666' }}
    >
      {type}
    </span>
  );
}

function VehicleBadge({ count }: { count: number }) {
  const v = vehicleForCount(count);
  return <span className="tl-vehicle-badge">{v}</span>;
}

// ─── Traveler row (editable) ───────────────────────────────────────────────

interface RowProps {
  t:        TravelerEntry;
  idx:      number;
  isOpen:   boolean;
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<TravelerEntry>) => void;
  onRemove: (id: string) => void;
}

function TravelerRow({ t, idx, isOpen, onToggle, onUpdate, onRemove }: RowProps) {
  const u = (field: keyof TravelerEntry) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onUpdate(t.id, { [field]: e.target.value });
  const setField = (field: keyof TravelerEntry) => (value: string) =>
    onUpdate(t.id, { [field]: value });

  return (
    <div className={`tl-traveler ${isOpen ? 'tl-traveler--open' : ''}`}>
      <div className="tl-traveler__head" onClick={() => onToggle(t.id)}>
        <span className="tl-traveler__num-wrap">
          <span className="tl-traveler__num" aria-hidden="true">{idx + 1}</span>
          <button
            className="tl-traveler__del-num"
            onClick={(e) => { e.stopPropagation(); onRemove(t.id); }}
            title="Remove traveler"
            aria-label={`Remove traveler ${idx + 1}`}
          >
            ×
          </button>
        </span>
        <span className="tl-traveler__name">
          {t.firstName || t.lastName
            ? `${t.firstName} ${t.lastName}`.trim()
            : <em>New traveler</em>}
        </span>
        {t.arrivalFlight && <span className="tl-traveler__tag">✈ {t.arrivalFlight}</span>}
        {t.departureFlight && <span className="tl-traveler__tag tl-traveler__tag--dep">✈ {t.departureFlight}</span>}
        <TypeBadge type={t.type} />
        <span className="tl-traveler__caret">{isOpen ? '▲' : '▼'}</span>
      </div>

      {isOpen && (
        <div className="tl-traveler__body">
          <fieldset className="tl-fs">
            <legend>Personal details</legend>
            <div className="tl-grid-3">
              <label>
                First name
                <input value={t.firstName} onChange={u('firstName')} placeholder="First name" />
              </label>
              <label>
                Last name
                <input value={t.lastName} onChange={u('lastName')} placeholder="Last name" />
              </label>
              <label>
                Phone / WhatsApp
                <input value={t.phone} onChange={u('phone')} placeholder="+1 555 000 0000" />
              </label>
            </div>
            <label>
              Role
              <select value={t.type} onChange={u('type')}>
                <option value="PARTICIPANT">Participant</option>
                <option value="EXPERT">Expert</option>
              </select>
            </label>
          </fieldset>

          <fieldset className="tl-fs tl-fs--arr">
            <legend>✈ Arrival</legend>
            <div className="tl-grid-3">
              <label>
                Arrival date
                <DateInput value={t.arrivalDate} onChange={setField('arrivalDate')} />
              </label>
              <label>
                Flight code
                <input value={t.arrivalFlight} onChange={u('arrivalFlight')} placeholder="TK 0355" />
              </label>
              <label>
                Arrival time
                <input type="time" value={t.arrivalTime} onChange={u('arrivalTime')} />
              </label>
            </div>
          </fieldset>

          <fieldset className="tl-fs tl-fs--dep">
            <legend>✈ Departure</legend>
            <div className="tl-grid-3">
              <label>
                Departure date
                <DateInput value={t.departureDate} onChange={setField('departureDate')} />
              </label>
              <label>
                Flight code
                <input value={t.departureFlight} onChange={u('departureFlight')} placeholder="TK 0356" />
              </label>
              <label>
                Flight departure time
                <input
                  type="time"
                  value={t.departureTime}
                  onChange={(e) => {
                    const newTime = e.target.value;
                    const pickup = t.departurePickupOffset
                      ? computePickupTime(newTime, t.departurePickupOffset)
                      : '';
                    onUpdate(t.id, { departureTime: newTime, departurePickup: pickup });
                  }}
                />
              </label>
            </div>
            <div className="tl-pickup-row">
              <label className="tl-pickup-label">
                Hotel pick-up
                <select
                  value={t.departurePickupOffset || ''}
                  onChange={(e) => {
                    const mins = parseInt(e.target.value, 10);
                    const pickup = mins && t.departureTime
                      ? computePickupTime(t.departureTime, mins)
                      : '';
                    onUpdate(t.id, { departurePickupOffset: mins || 0, departurePickup: pickup });
                  }}
                >
                  <option value="">— select offset —</option>
                  {PICKUP_OFFSETS.map((m) => (
                    <option key={m} value={m}>{offsetLabel(m)}</option>
                  ))}
                </select>
              </label>
              {t.departurePickup && (() => {
                const [dh, dm] = (t.departureTime || '').split(':').map(Number);
                const depMins  = (dh || 0) * 60 + (dm || 0);
                const prevDay  = t.departurePickupOffset > 0 && depMins < t.departurePickupOffset;
                return (
                  <div className="tl-pickup-result">
                    <span className="tl-pickup-result__label">Pick-up at</span>
                    <span className="tl-pickup-result__time">{t.departurePickup}</span>
                    {prevDay && <span className="tl-pickup-result__note">(prev day)</span>}
                  </div>
                );
              })()}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}

// ─── Preview table ─────────────────────────────────────────────────────────

interface FlightGroup {
  key:     string;
  date:    string;
  flight:  string;
  time:    string;
  pickup?: string;
  members: TravelerEntry[];
}

function sortGroups(groups: Map<string, TravelerEntry[]>): FlightGroup[] {
  return [...groups.entries()]
    .map(([key, members]) => {
      const [date, flight, time] = key.split('|');
      const pickup = members[0]?.departurePickup ?? '';
      return { key, date, flight, time, pickup, members };
    })
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : a.time.localeCompare(b.time);
    });
}

function ArrivalsPreview({
  travelers, airport, hotel,
}: { travelers: TravelerEntry[]; airport: string; hotel: string }) {
  const valid = travelers.filter((t) => t.arrivalFlight || t.arrivalDate);
  if (valid.length === 0)
    return <p className="tl-preview__empty">No arrival data entered yet.</p>;

  const groups = sortGroups(
    groupByKey(valid, (t) => `${t.arrivalDate}|${t.arrivalFlight}|${t.arrivalTime}`)
  );

  return (
    <div className="tl-preview-section">
      <div className="tl-preview__title">
        From {airport || '{Airport}'} → {hotel || '{Hotel}'}
      </div>
      <table className="tl-preview-table">
        <thead>
          <tr>
            <th>Nr</th><th>First Name</th><th>Last Name</th><th>Phone</th>
            <th>Date</th><th>Flight</th><th>Time</th><th>Vehicle</th><th>Type</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <>
              <tr key={g.key + '-sep'} className="tl-sep"><td colSpan={9} /></tr>
              {g.members.map((t, i) => (
                <tr key={t.id} className={i === 0 ? 'tl-row-first' : ''}>
                  <td>{i + 1}</td>
                  <td>{t.firstName}</td>
                  <td>{t.lastName}</td>
                  <td>{t.phone}</td>
                  <td>{i === 0 ? t.arrivalDate  : ''}</td>
                  <td>{i === 0 ? t.arrivalFlight : ''}</td>
                  <td>{i === 0 ? t.arrivalTime  : ''}</td>
                  <td>{i === 0 ? <VehicleBadge count={g.members.length} /> : ''}</td>
                  <td><TypeBadge type={t.type} /></td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeparturesPreview({
  travelers, hotel, airport,
}: { travelers: TravelerEntry[]; hotel: string; airport: string }) {
  const valid = travelers.filter((t) => t.departureFlight || t.departureDate);
  if (valid.length === 0)
    return <p className="tl-preview__empty">No departure data entered yet.</p>;

  const groups = sortGroups(
    groupByKey(valid, (t) => `${t.departureDate}|${t.departureFlight}|${t.departureTime}`)
  );

  return (
    <div className="tl-preview-section">
      <div className="tl-preview__title">
        From {hotel || '{Hotel}'} → {airport || '{Airport}'}
      </div>
      <table className="tl-preview-table">
        <thead>
          <tr>
            <th>Nr</th><th>First Name</th><th>Last Name</th><th>Phone</th>
            <th>Date</th><th>Flight</th><th>Time</th><th>Vehicle</th><th>Hotel Pickup</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <>
              <tr key={g.key + '-sep'} className="tl-sep"><td colSpan={9} /></tr>
              {g.members.map((t, i) => (
                <tr key={t.id} className={i === 0 ? 'tl-row-first' : ''}>
                  <td>{i + 1}</td>
                  <td>{t.firstName}</td>
                  <td>{t.lastName}</td>
                  <td>{t.phone}</td>
                  <td>{i === 0 ? t.departureDate   : ''}</td>
                  <td>{i === 0 ? t.departureFlight  : ''}</td>
                  <td>{i === 0 ? t.departureTime   : ''}</td>
                  <td>{i === 0 ? <VehicleBadge count={g.members.length} /> : ''}</td>
                  <td>{i === 0 ? (g.pickup || t.departurePickup) : ''}</td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export function TransferListPage() {
  const [sp] = useSearchParams();
  const formId = useId();
  const { user } = useUser();

  const [setup, setSetup] = useState<TransferSetup>({
    eventCode:        sp.get('code')     ?? '',
    eventRowId:       '',
    eventCity:        sp.get('city')     ?? '',
    eventDates:       sp.get('dates')    ?? '',
    hotel:            sp.get('hotel')    ?? '',
    arrivalAirport:   sp.get('airport')  ?? '',
    departureAirport: sp.get('dairport') ?? '',
  });

  const [travelers, setTravelers] = useState<TravelerEntry[]>(() => [emptyTraveler()]);
  // ID of the currently expanded traveler card. Null = all collapsed.
  const [openId, setOpenId] = useState<string | null>(
    () => travelers[0]?.id ?? null
  );

  const [activeTab, setActiveTab] = useState<'arrivals' | 'departures'>('arrivals');
  const [exporting, setExporting] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [savedAt,   setSavedAt]   = useState<string | null>(null);
  const [savedBy,   setSavedBy]   = useState<string>('');
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [financialsSyncError, setFinancialsSyncError] = useState<string | null>(null);
  const [restoreBanner, setRestoreBanner] = useState<{ setup: TransferSetup; travelers: TravelerEntry[]; savedAt: string; savedBy: string; driveUrl?: string; driveFileId?: string } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Active events for the dropdown
  const [events, setEvents] = useState<Event[]>([]);
  useEffect(() => {
    fetchEvents().then((res) => {
      const now = Date.now();
      const COMPLETED_MS = 15 * 24 * 60 * 60 * 1000;
      const active = res.events.filter((ev) => {
        const end = ev.endDate ? new Date(ev.endDate).getTime() : Infinity;
        return now - end < COMPLETED_MS;
      });
      setEvents(active);
    }).catch(() => {});
  }, []);

  function pickEvent(code: string) {
    const ev = events.find((e) => e.code === code);
    if (!ev) return;
    setSetup((s) => ({
      ...s,
      eventCode: ev.code,
      eventRowId: ev.rowId ?? '',
      eventCity: ev.location || '',
      eventDates: ev.dates || '',
    }));
    // Offer to restore saved data when switching to an event that has one
    const saved = loadTransferList(ev.code);
    if (saved && saved.travelers.length > 0) {
      setRestoreBanner(saved);
      const meta = driveMetaFromSaved(saved);
      setDriveLink(meta.driveUrl);
      setDriveFileId(meta.driveFileId);
    } else {
      setRestoreBanner(null);
      setDriveLink(null);
      setDriveFileId(null);
    }
  }

  // On mount: if a ?code= param is present and there is saved data, offer restore
  useEffect(() => {
    const code = sp.get('code');
    if (!code) return;
    const saved = loadTransferList(code);
    if (saved && saved.travelers.length > 0) {
      setRestoreBanner(saved);
      // Also surface the last-saved timestamp in the indicator
      setSavedAt(saved.savedAt);
      setSavedBy(saved.savedBy);
      const meta = driveMetaFromSaved(saved);
      setDriveLink(meta.driveUrl);
      setDriveFileId(meta.driveFileId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyRestore() {
    if (!restoreBanner) return;
    setSetup(restoreBanner.setup);
    setTravelers(restoreBanner.travelers);
    setOpenId(restoreBanner.travelers[0]?.id ?? null);
    setSavedAt(restoreBanner.savedAt);
    setSavedBy(restoreBanner.savedBy);
    const meta = driveMetaFromSaved(restoreBanner);
    setDriveLink(meta.driveUrl);
    setDriveFileId(meta.driveFileId);
    setRestoreBanner(null);
  }

  async function handleSave() {
    if (!setup.eventCode) return;
    setSaving(true);
    setSaveError(null);
    setFinancialsSyncError(null);
    const now = new Date().toISOString();
    const name = user?.name ?? 'Unknown';
    const email = user?.email ?? '';
    const fileName = transferListFilename(setup);
    let nextDriveUrl = driveLink;
    let nextDriveFileId = driveFileId;

    try {
      const buffer = transferListToArrayBuffer(travelers, setup);
      const result = await saveTransferListToDrive({
        eventCode: setup.eventCode,
        fileName,
        dataBase64: arrayBufferToBase64(buffer),
        uploadedBy: name,
        actorEmail: email,
        eventLocation: setup.eventCity,
        driveFileId: driveFileId ?? undefined,
      });
      nextDriveUrl = result.driveUrl;
      nextDriveFileId = result.driveFileId;
      setDriveLink(result.driveUrl);
      setDriveFileId(result.driveFileId);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save to Google Drive');
    }

    saveTransferList(setup.eventCode, {
      setup,
      travelers,
      savedAt: now,
      savedBy: name,
      savedByEmail: email,
      driveUrl: nextDriveUrl ?? undefined,
      driveFileId: nextDriveFileId ?? undefined,
    });
    setSavedAt(now);
    setSavedBy(name);

    try {
      await syncGeneratorCostItems(setup.eventCode, setup.eventRowId, buildTransferCostLines(travelers), email);
    } catch (e) {
      setFinancialsSyncError(e instanceof Error ? e.message : 'Could not sync to Financials');
    }

    setTimeout(() => setSaving(false), 800);
  }

  async function handleCopyLink() {
    if (!driveLink) return;
    try {
      await navigator.clipboard.writeText(driveLink);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = driveLink;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function patchSetup(field: keyof TransferSetup) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setSetup((s) => ({ ...s, [field]: e.target.value }));
  }

  function addTraveler() {
    const next = emptyTraveler();
    setTravelers((ts) => [...ts, next]);
    setOpenId(next.id);
    setTimeout(() => listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' }), 60);
  }

  function toggleOpen(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  function updateTraveler(id: string, patch: Partial<TravelerEntry>) {
    setTravelers((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeTraveler(id: string) {
    setTravelers((ts) => {
      const next = ts.filter((t) => t.id !== id);
      // If we removed the open card, open the one above it (or below)
      if (id === openId) {
        const removedIdx = ts.findIndex((t) => t.id === id);
        const sibling = next[removedIdx] ?? next[removedIdx - 1];
        setOpenId(sibling?.id ?? null);
      }
      return next;
    });
  }

  async function handleTicketFiles(files: FileList | File[]) {
    if (!setup.eventCity) {
      setParseErrors(['Please select an event (or enter a city) before uploading tickets.']);
      return;
    }
    setParsing(true);
    setParseErrors([]);
    const errs: string[] = [];
    const newTravelers: TravelerEntry[] = [];

    for (const file of Array.from(files)) {
      try {
        const result = await parseTicketPdf(file, setup.eventCity);
        const t: TravelerEntry = {
          ...emptyTraveler(),
          firstName:       result.firstName,
          lastName:        result.lastName,
          arrivalDate:     result.arrivalDate,
          arrivalFlight:   result.arrivalFlight,
          arrivalTime:     result.arrivalTime,
          departureDate:   result.departureDate,
          departureFlight: result.departureFlight,
          departureTime:   result.departureTime,
        };
        newTravelers.push(t);
      } catch (e) {
        errs.push(`${file.name}: ${e instanceof Error ? e.message : 'parse error'}`);
      }
    }

    if (newTravelers.length) {
      // Replace the single empty placeholder if it's still untouched
      setTravelers((ts) => {
        const isEmpty = ts.length === 1 && !ts[0].firstName && !ts[0].arrivalFlight;
        const base = isEmpty ? [] : ts;
        return [...base, ...newTravelers];
      });
      setOpenId(newTravelers[newTravelers.length - 1].id);
      setTimeout(() => listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' }), 80);
    }

    setParseErrors(errs);
    setParsing(false);
  }

  function handleDropZone(e: React.DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length) handleTicketFiles(files);
  }

  function handleExport() {
    setExporting(true);
    try {
      exportTransferList(travelers, setup);
    } finally {
      setTimeout(() => setExporting(false), 1000);
    }
  }

  const filename = transferListFilename(setup);

  return (
    <div className="tl-page">
      {/* ── Nav ── */}
      <nav className="tl-nav">
        <Link to="/">← Back to Events</Link>
        <span className="tl-nav__title">Transfer List Generator</span>
        {(setup.eventCode || setup.eventCity) && (
          <span className="tl-nav__event">
            {setup.eventCode}{setup.eventCity ? ` · ${setup.eventCity}` : ''}
            {setup.eventDates ? ` · ${setup.eventDates}` : ''}
          </span>
        )}
      </nav>

      <div className="tl-body">
        {/* ────────────────── LEFT: Setup + Traveler entry ────────────────── */}
        <aside className="tl-sidebar">

          {/* Event picker */}
          <section className="tl-section">
            <h2>Event</h2>
            <label htmlFor={formId + '-event-pick'}>
              Select active event
              <select
                id={formId + '-event-pick'}
                value={setup.eventCode}
                onChange={(e) => pickEvent(e.target.value)}
              >
                <option value="">— choose event —</option>
                {events.map((ev) => (
                  <option key={ev.code} value={ev.code}>
                    {ev.code}{ev.location ? ` · ${ev.location}` : ''}{ev.dates ? ` (${ev.dates})` : ''}
                  </option>
                ))}
              </select>
            </label>

            {/* Editable overrides — shown once an event is selected or if manually filled */}
            {(setup.eventCode || setup.eventCity || setup.eventDates) && (
              <div className="tl-grid-3 tl-event-override">
                <label htmlFor={formId + '-code'}>
                  Code
                  <input id={formId + '-code'} value={setup.eventCode} onChange={patchSetup('eventCode')} placeholder="K000" />
                </label>
                <label htmlFor={formId + '-city'}>
                  City
                  <input id={formId + '-city'} value={setup.eventCity} onChange={patchSetup('eventCity')} placeholder="Istanbul" />
                </label>
                <label htmlFor={formId + '-dates'}>
                  Dates
                  <input id={formId + '-dates'} value={setup.eventDates} onChange={patchSetup('eventDates')} placeholder="Dec 12-13, 2024" />
                </label>
              </div>
            )}
          </section>

          {/* Logistics */}
          <section className="tl-section">
            <h2>Logistics</h2>
            <label htmlFor={formId + '-hotel'}>
              Hotel name
              <input id={formId + '-hotel'} value={setup.hotel} onChange={patchSetup('hotel')} placeholder="Hilton Istanbul Bosphorus" />
            </label>
            <div className="tl-grid-2" style={{ marginTop: '0.6rem' }}>
              <label htmlFor={formId + '-arr'}>
                Arrival airport
                <input id={formId + '-arr'} value={setup.arrivalAirport} onChange={patchSetup('arrivalAirport')} placeholder="Istanbul Airport (IST)" />
              </label>
              <label htmlFor={formId + '-dep'}>
                Departure airport
                <input
                  id={formId + '-dep'}
                  value={setup.departureAirport}
                  onChange={patchSetup('departureAirport')}
                  placeholder="Same as arrival if blank"
                />
              </label>
            </div>
          </section>

          {/* Travelers */}
          <section className="tl-section tl-section--travelers">
            <div className="tl-section__head">
              <h2>Travelers <span className="tl-section__count">({travelers.length})</span></h2>
              <button type="button" className="tl-btn-add" onClick={addTraveler}>
                + Add manually
              </button>
            </div>

            {/* Ticket upload drop zone */}
            <div
              className={`tl-dropzone ${parsing ? 'tl-dropzone--parsing' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropZone}
              onClick={() => !parsing && uploadRef.current?.click()}
            >
              <input
                ref={uploadRef}
                type="file"
                accept="application/pdf"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => e.target.files && handleTicketFiles(e.target.files)}
              />
              {parsing ? (
                <span className="tl-dropzone__text">⏳ Reading tickets…</span>
              ) : (
                <>
                  <span className="tl-dropzone__icon">📎</span>
                  <span className="tl-dropzone__text">
                    Drop e-ticket PDFs here or <strong>click to upload</strong>
                  </span>
                  <span className="tl-dropzone__hint">
                    One or multiple tickets — name, flights &amp; times auto-extracted
                  </span>
                </>
              )}
            </div>

            {parseErrors.length > 0 && (
              <div className="tl-parse-errors">
                {parseErrors.map((e, i) => <p key={i}>⚠ {e}</p>)}
              </div>
            )}

            <div className="tl-traveler-list" ref={listRef}>
              {travelers.map((t, idx) => (
                <TravelerRow
                  key={t.id}
                  t={t}
                  idx={idx}
                  isOpen={openId === t.id}
                  onToggle={toggleOpen}
                  onUpdate={updateTraveler}
                  onRemove={removeTraveler}
                />
              ))}
            </div>
          </section>

          {/* Vehicle legend */}
          <section className="tl-section tl-section--legend">
            <h2>Vehicle assignment</h2>
            <div className="tl-vehicle-legend">
              {[['1–2', 'SEDAN'], ['3–7', 'VAN'], ['8–14', 'SPRINTER'], ['15–24', 'MINIBUS'], ['25–45', 'BUS']].map(([range, v]) => (
                <div key={v} className="tl-vl-row">
                  <span className="tl-vl-range">{range} pax</span>
                  <span className="tl-vehicle-badge">{v}</span>
                </div>
              ))}
            </div>
            <p className="tl-legend-note">
              Vehicle type is assigned automatically per flight group.
            </p>
          </section>

          {/* Restore banner */}
          {restoreBanner && (
            <div className="tl-restore-banner">
              <div className="tl-restore-banner__body">
                <span className="tl-restore-banner__icon">💾</span>
                <div>
                  <strong>{restoreBanner.travelers.length} traveler{restoreBanner.travelers.length !== 1 ? 's' : ''} saved</strong>
                  <span className="tl-restore-banner__meta">
                    {restoreBanner.savedBy && `by ${restoreBanner.savedBy} · `}
                    {new Date(restoreBanner.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <div className="tl-restore-banner__actions">
                <button className="tl-restore-banner__btn tl-restore-banner__btn--yes" onClick={applyRestore}>
                  Restore
                </button>
                <button className="tl-restore-banner__btn tl-restore-banner__btn--no" onClick={() => setRestoreBanner(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Export + Save */}
          <section className="tl-section tl-section--export">
            <div className="tl-filename">📄 {filename}</div>
            {savedAt && (
              <div className="tl-saved-chip">
                ✓ Saved{savedBy ? ` by ${savedBy}` : ''} · {new Date(savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {savedAt && setup.eventCode && (
              <Link className="tl-financials-link" to={`/event/${setup.eventCode}?tab=financials`}>
                View in Financials →
              </Link>
            )}
            {saveError && (
              <p className="tl-save-error">⚠ {saveError}</p>
            )}
            {financialsSyncError && (
              <p className="tl-save-error">⚠ Financials sync failed: {financialsSyncError}</p>
            )}
            <div className="tl-export-row">
              <button
                type="button"
                className="tl-export-btn"
                onClick={handleExport}
                disabled={exporting || travelers.length === 0}
              >
                {exporting ? '⏳ Generating…' : '📥 Export Excel (.xlsx)'}
              </button>
              {driveLink && (
                <button
                  type="button"
                  className="tl-link-btn"
                  onClick={handleCopyLink}
                  title="Copy Google Drive link to clipboard"
                >
                  {linkCopied ? '✓ Copied!' : '🔗 Link'}
                </button>
              )}
              <button
                type="button"
                className="tl-save-btn"
                onClick={handleSave}
                disabled={saving || !setup.eventCode || travelers.length === 0}
                title={!setup.eventCode ? 'Select an event first' : 'Save transfer list to Google Drive'}
              >
                {saving ? '⏳ Saving…' : '💾 Save'}
              </button>
            </div>
            {!setup.eventCode && (
              <p className="tl-save-hint">Select an event above to enable saving.</p>
            )}
          </section>
        </aside>

        {/* ────────────────── RIGHT: Live preview ────────────────── */}
        <main className="tl-preview">
          <div className="tl-preview__tabs">
            <button
              className={`tl-tab ${activeTab === 'arrivals' ? 'tl-tab--active' : ''}`}
              onClick={() => setActiveTab('arrivals')}
            >
              ✈ Arrivals
            </button>
            <button
              className={`tl-tab ${activeTab === 'departures' ? 'tl-tab--active' : ''}`}
              onClick={() => setActiveTab('departures')}
            >
              ✈ Departures
            </button>
          </div>

          <div className="tl-preview__content">
            {activeTab === 'arrivals' && (
              <ArrivalsPreview
                travelers={travelers}
                airport={setup.arrivalAirport}
                hotel={setup.hotel}
              />
            )}
            {activeTab === 'departures' && (
              <DeparturesPreview
                travelers={travelers}
                hotel={setup.hotel}
                airport={setup.departureAirport || setup.arrivalAirport}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
