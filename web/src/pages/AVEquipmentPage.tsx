/**
 * AV Equipment List Generator
 *
 * Builds the PSA AV Equipment list for a conference event and exports
 * a styled .xlsx file matching the PSA template.
 *
 * Route: /av-equipment
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchEvents, saveAVEquipmentToDrive } from '../api/client';
import {
  avEquipmentFilename,
  avEquipmentToArrayBuffer,
  exportAVEquipment,
} from '../utils/exportAVEquipment';
import { loadAVEquipment, saveAVEquipment } from '../utils/avEquipmentStore';
import { buildAVCostLines } from '../utils/avFinancialsSync';
import { syncGeneratorCostItems } from '../utils/generatorFinancialsSync';
import { useUser } from '../context/UserContext';
import type { Event } from '../types';
import { formatIsoDate } from '../utils/dateFormat';
import './AVEquipmentPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AVSetup {
  eventCode:  string;
  eventRowId: string;
  eventCity:  string;
  eventDate:  string;
  setupStyle: string;
  pax:        string;
  days:       number;
}

export interface SupplyItemState {
  id:     string;
  name:   string;
  amount: number;
}

export interface AVItemState {
  id:          string;
  enabled:     boolean;
  // LCD projector (id: 'lcd')
  luminosity?: number;
  // Projector screen (id: 'screen')
  screenSize?: string;
  // Generic amount
  amount?:     number;
  // Wireless mics (id: 'mic-wireless')
  lapel?:      number;
  handheld?:   number;
  // Interpretation system (id: 'interp')
  receivers?:  number;
  booths?:     number;
}

// ─── Build the description string written to the Excel cell ──────────────────

export function buildDescription(item: AVItemState): string {
  switch (item.id) {
    case 'sound':
      return 'Sound system in the conference room integrated with A/V and interpretation equipment';
    case 'lcd':
      return `LCD projectors (min ${item.luminosity ?? 4500} lumin)`;
    case 'screen':
      return `Projector screens (min ${item.screenSize ?? '2.5 x 3.5'} meters)`;
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
    case 'mic-wireless': {
      const lapel    = item.lapel    ?? 0;
      const handheld = item.handheld ?? 0;
      const parts: string[] = [];
      if (lapel    > 0) parts.push(`${lapel} Lapel`);
      if (handheld > 0) parts.push(`${handheld} wireless handheld`);
      return `Number of Wireless, portable and lapel microphones${parts.length ? `: (${parts.join(', ')})` : ''}`;
    }
    case 'internet':
      return 'Dedicated internet connection (to support video conference capability for participants unable to attend who wish to join virtually)';
    case 'camera':
      return 'HD camera & interpretation sound transmitted to the Zoom';
    case 'interp': {
      const b = item.booths    ?? 1;
      const r = item.receivers ?? 65;
      return `Simultaneous Interpretation System / ${b} Fully covered interpretation booth${b !== 1 ? 's' : ''} for ${b * 2} interpreters and receivers for up to ${r} people`;
    }
    default:
      return '';
  }
}

// ─── Equipment item definitions ───────────────────────────────────────────────

interface ItemDef {
  id:    string;
  label: string;
}

const ITEM_DEFS: ItemDef[] = [
  { id: 'sound',       label: 'Sound system' },
  { id: 'lcd',         label: 'LCD projector' },
  { id: 'screen',      label: 'Projector screen' },
  { id: 'laptop',      label: 'Laptop' },
  { id: 'feedback',    label: 'Feedback monitor' },
  { id: 'printer',     label: 'Printer' },
  { id: 'mic-fixed',   label: 'Fixed tabletop microphone' },
  { id: 'mic-head',    label: 'Fixed tabletop microphone — Head Table' },
  { id: 'podium',      label: 'Podium with a mic' },
  { id: 'mic-wireless',label: 'Wireless, portable & lapel microphones' },
  { id: 'internet',    label: 'Dedicated internet connection' },
  { id: 'camera',      label: 'HD camera' },
  { id: 'interp',      label: 'Simultaneous Interpretation System' },
];

const SETUP_STYLES = ['Classroom', 'Cabaret', 'Theatre', 'U-Shape', 'Boardroom'];

const SCREEN_SIZES = [
  '2.5 x 3.5', '3 x 3.5', '3 x 4', '3.5 x 5',
];

export const SUPPLY_CATALOG = ['Briefing Folders', 'Table Tent Cards', 'Pen and Notepads', 'Name Badges'];
const CUSTOM_SUPPLY = '__custom__';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Range helpers ────────────────────────────────────────────────────────────

function range(from: number, to: number, step = 1): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

// ─── Default item state ───────────────────────────────────────────────────────

function defaultItems(): AVItemState[] {
  return [
    { id: 'sound',        enabled: false },
    { id: 'lcd',          enabled: false, luminosity: 4500, amount: 1 },
    { id: 'screen',       enabled: false, screenSize: '2.5 x 3.5', amount: 1 },
    { id: 'laptop',       enabled: false, amount: 1 },
    { id: 'feedback',     enabled: false, amount: 1 },
    { id: 'printer',      enabled: false, amount: 1 },
    { id: 'mic-fixed',    enabled: false, amount: 84 },
    { id: 'mic-head',     enabled: false, amount: 5 },
    { id: 'podium',       enabled: false },
    { id: 'mic-wireless', enabled: false, lapel: 2, handheld: 3 },
    { id: 'internet',     enabled: false, amount: 1 },
    { id: 'camera',       enabled: false, amount: 1 },
    { id: 'interp',       enabled: false, receivers: 65, booths: 1 },
  ];
}

// ─── Page component ───────────────────────────────────────────────────────────

export function AVEquipmentPage() {
  const [sp] = useSearchParams();
  const { user } = useUser();

  const [setup, setSetup] = useState<AVSetup>({
    eventCode:  sp.get('code') ?? '',
    eventRowId: '',
    eventCity:  sp.get('city') ?? '',
    eventDate:  sp.get('dates') ?? '',
    setupStyle: 'Classroom',
    pax:        '',
    days:       1,
  });

  const [items, setItems]         = useState<AVItemState[]>(defaultItems);
  const [supplies, setSupplies]   = useState<SupplyItemState[]>([]);
  const [newSupplyName, setNewSupplyName]     = useState<string>(SUPPLY_CATALOG[0]);
  const [newSupplyCustom, setNewSupplyCustom] = useState('');
  const [newSupplyAmount, setNewSupplyAmount] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [savedAt, setSavedAt]     = useState<string | null>(null);
  const [savedBy, setSavedBy]     = useState('');
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [financialsSyncError, setFinancialsSyncError] = useState<string | null>(null);
  const [events, setEvents]       = useState<Event[]>([]);

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

  useEffect(() => {
    const code = sp.get('code');
    if (!code) return;
    const saved = loadAVEquipment(code);
    if (!saved) return;
    setSetup(saved.setup);
    setItems(saved.items);
    setSupplies(saved.supplies ?? []);
    setSavedAt(saved.savedAt);
    setSavedBy(saved.savedBy);
    applyDriveMeta(saved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyDriveMeta(saved: { driveUrl?: string; driveFileId?: string }) {
    const id = saved.driveFileId || driveFileIdFromUrl(saved.driveUrl);
    setDriveFileId(id ?? null);
    setDriveLink(
      saved.driveUrl ||
        (id ? `https://drive.google.com/file/d/${id}/view?usp=sharing` : null),
    );
  }

  function pickEvent(code: string) {
    const ev = events.find((e) => e.code === code);
    if (!ev) return;
    setSetup((s) => ({
      ...s,
      eventCode: ev.code ?? '',
      eventRowId: ev.rowId ?? '',
      eventCity: ev.location ?? '',
      eventDate: ev.startDate ? formatEventDate(ev.startDate) : '',
    }));
    const saved = loadAVEquipment(ev.code);
    if (saved) {
      setSetup(saved.setup);
      setItems(saved.items);
      setSupplies(saved.supplies ?? []);
      setSavedAt(saved.savedAt);
      setSavedBy(saved.savedBy);
      applyDriveMeta(saved);
    } else {
      setSupplies([]);
      setSavedAt(null);
      setSavedBy('');
      setDriveLink(null);
      setDriveFileId(null);
    }
  }

  function patchSetup<K extends keyof AVSetup>(field: K, value: AVSetup[K]) {
    setSetup((s) => ({ ...s, [field]: value }));
  }

  function patchItem(id: string, patch: Partial<AVItemState>) {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, ...patch } : it));
  }

  function toggleItem(id: string) {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, enabled: !it.enabled } : it));
  }

  function addSupply() {
    const name = newSupplyName === CUSTOM_SUPPLY ? newSupplyCustom.trim() : newSupplyName;
    if (!name) return;
    setSupplies((prev) => [...prev, { id: uid(), name, amount: newSupplyAmount > 0 ? newSupplyAmount : 1 }]);
    setNewSupplyCustom('');
    setNewSupplyAmount(1);
  }

  function updateSupplyAmount(id: string, amount: number) {
    setSupplies((prev) => prev.map((s) => s.id === id ? { ...s, amount } : s));
  }

  function removeSupply(id: string) {
    setSupplies((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleExport() {
    setExporting(true);
    try {
      exportAVEquipment(setup, items, supplies);
    } finally {
      setExporting(false);
    }
  }

  async function handleSave() {
    if (!setup.eventCode) return;
    setSaving(true);
    setSaveError(null);
    setFinancialsSyncError(null);
    const now = new Date().toISOString();
    const name = user?.name ?? 'Unknown';
    const email = user?.email ?? '';
    const fileName = avEquipmentFilename(setup);
    let nextDriveUrl = driveLink;
    let nextDriveFileId = driveFileId;

    try {
      const buffer = avEquipmentToArrayBuffer(setup, items, supplies);
      const result = await saveAVEquipmentToDrive({
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

    saveAVEquipment(setup.eventCode, {
      setup,
      items,
      supplies,
      savedAt: now,
      savedBy: name,
      savedByEmail: email,
      driveUrl: nextDriveUrl ?? undefined,
      driveFileId: nextDriveFileId ?? undefined,
    });
    setSavedAt(now);
    setSavedBy(name);

    try {
      await syncGeneratorCostItems(setup.eventCode, setup.eventRowId, buildAVCostLines(items, supplies), email);
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

  const enabledItems = items.filter((it) => it.enabled);
  const hasContent = enabledItems.length > 0 || supplies.length > 0;
  const filename = avEquipmentFilename(setup);

  return (
    <div className="av-page">
      {/* ── Nav ── */}
      <nav className="av-nav">
        <Link to="/generators" className="av-nav__back">← Generators</Link>
        <span className="av-nav__title">AV Equipment List Generator</span>
      </nav>

      <div className="av-body">
        {/* ══ LEFT PANEL ═══════════════════════════════════════════════════════ */}
        <aside className="av-panel av-panel--left">

          {/* Event picker */}
          <section className="av-section">
            <h3 className="av-section__title">Event</h3>
            {events.length > 0 && (
              <label className="av-label">
                Select active event
                <select
                  className="av-select"
                  value={setup.eventCode}
                  onChange={(e) => pickEvent(e.target.value)}
                >
                  <option value="">— pick event —</option>
                  {events.map((ev) => (
                    <option key={ev.code} value={ev.code}>
                      {ev.code} — {ev.location}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="av-grid-3">
              <label className="av-label">
                Event code
                <input className="av-input" value={setup.eventCode}
                  onChange={(e) => patchSetup('eventCode', e.target.value)} placeholder="J027" />
              </label>
              <label className="av-label">
                City
                <input className="av-input" value={setup.eventCity}
                  onChange={(e) => patchSetup('eventCity', e.target.value)} placeholder="Tbilisi" />
              </label>
              <label className="av-label">
                Date
                <input className="av-input" value={setup.eventDate}
                  onChange={(e) => patchSetup('eventDate', e.target.value)} placeholder="June 5" />
              </label>
            </div>
          </section>

          {/* Conference setup */}
          <section className="av-section">
            <h3 className="av-section__title">Conference Setup</h3>
            <div className="av-grid-3">
              <label className="av-label">
                Setup style
                <select className="av-select" value={setup.setupStyle}
                  onChange={(e) => patchSetup('setupStyle', e.target.value)}>
                  {SETUP_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="av-label">
                PAX (capacity)
                <input className="av-input" type="number" min={1} value={setup.pax}
                  onChange={(e) => patchSetup('pax', e.target.value)} placeholder="150" />
              </label>
              <label className="av-label">
                Days AV needed
                <select className="av-select" value={setup.days}
                  onChange={(e) => patchSetup('days', parseInt(e.target.value))}>
                  {range(1, 8).map((d) => (
                    <option key={d} value={d}>{d} {d === 1 ? 'day' : 'days'}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* Equipment checklist */}
          <section className="av-section">
            <h3 className="av-section__title">Equipment Selection</h3>
            <p className="av-section__hint">Check items to include in the list. Configure options below each item.</p>

            <div className="av-equipment-list">
              {ITEM_DEFS.map((def, idx) => {
                const item = items.find((it) => it.id === def.id)!;
                return (
                  <div key={def.id} className={`av-item ${item.enabled ? 'av-item--on' : ''}`}>
                    <label className="av-item__head">
                      <input
                        type="checkbox"
                        className="av-item__check"
                        checked={item.enabled}
                        onChange={() => toggleItem(def.id)}
                      />
                      <span className="av-item__num">{idx + 1}</span>
                      <span className="av-item__label">{def.label}</span>
                    </label>

                    {item.enabled && (
                      <div className="av-item__opts">
                        {/* Sound system — no extra options */}
                        {def.id === 'podium' && (
                          <span className="av-item__fixed">Qty: 1 (fixed)</span>
                        )}

                        {/* LCD projector */}
                        {def.id === 'lcd' && (
                          <div className="av-item__opt-row">
                            <label className="av-opt-label">
                              Luminosity
                              <select className="av-select av-select--sm"
                                value={item.luminosity ?? 4500}
                                onChange={(e) => patchItem(def.id, { luminosity: parseInt(e.target.value) })}>
                                {range(3000, 8000, 1000).map((l) => (
                                  <option key={l} value={l}>{l.toLocaleString()} lm</option>
                                ))}
                              </select>
                            </label>
                            <label className="av-opt-label">
                              Amount
                              <select className="av-select av-select--sm"
                                value={item.amount ?? 1}
                                onChange={(e) => patchItem(def.id, { amount: parseInt(e.target.value) })}>
                                {range(1, 10).map((n) => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </label>
                          </div>
                        )}

                        {/* Projector screen */}
                        {def.id === 'screen' && (
                          <div className="av-item__opt-row">
                            <label className="av-opt-label">
                              Size
                              <select className="av-select av-select--sm"
                                value={item.screenSize ?? '2.5 x 3.5'}
                                onChange={(e) => patchItem(def.id, { screenSize: e.target.value })}>
                                {SCREEN_SIZES.map((s) => (
                                  <option key={s} value={s}>{s} m</option>
                                ))}
                              </select>
                            </label>
                            <label className="av-opt-label">
                              Amount
                              <select className="av-select av-select--sm"
                                value={item.amount ?? 1}
                                onChange={(e) => patchItem(def.id, { amount: parseInt(e.target.value) })}>
                                {range(1, 10).map((n) => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </label>
                          </div>
                        )}

                        {/* Laptop */}
                        {def.id === 'laptop' && (
                          <label className="av-opt-label">
                            Amount
                            <select className="av-select av-select--sm"
                              value={item.amount ?? 1}
                              onChange={(e) => patchItem(def.id, { amount: parseInt(e.target.value) })}>
                              {range(1, 15).map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </label>
                        )}

                        {/* Feedback monitor */}
                        {def.id === 'feedback' && (
                          <label className="av-opt-label">
                            Amount
                            <select className="av-select av-select--sm"
                              value={item.amount ?? 1}
                              onChange={(e) => patchItem(def.id, { amount: parseInt(e.target.value) })}>
                              {range(1, 3).map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </label>
                        )}

                        {/* Printer */}
                        {def.id === 'printer' && (
                          <label className="av-opt-label">
                            Amount
                            <select className="av-select av-select--sm"
                              value={item.amount ?? 1}
                              onChange={(e) => patchItem(def.id, { amount: parseInt(e.target.value) })}>
                              {range(1, 3).map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </label>
                        )}

                        {/* Fixed tabletop mic */}
                        {def.id === 'mic-fixed' && (
                          <label className="av-opt-label">
                            Amount
                            <select className="av-select av-select--sm"
                              value={item.amount ?? 10}
                              onChange={(e) => patchItem(def.id, { amount: parseInt(e.target.value) })}>
                              {range(10, 150, 1).map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </label>
                        )}

                        {/* Head table mic */}
                        {def.id === 'mic-head' && (
                          <label className="av-opt-label">
                            Amount
                            <select className="av-select av-select--sm"
                              value={item.amount ?? 1}
                              onChange={(e) => patchItem(def.id, { amount: parseInt(e.target.value) })}>
                              {range(1, 10).map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </label>
                        )}

                        {/* Wireless / lapel mics */}
                        {def.id === 'mic-wireless' && (
                          <div className="av-item__opt-row">
                            <label className="av-opt-label">
                              Lapel mics
                              <select className="av-select av-select--sm"
                                value={item.lapel ?? 2}
                                onChange={(e) => patchItem(def.id, { lapel: parseInt(e.target.value) })}>
                                {range(1, 4).map((n) => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </label>
                            <label className="av-opt-label">
                              Wireless handheld
                              <select className="av-select av-select--sm"
                                value={item.handheld ?? 3}
                                onChange={(e) => patchItem(def.id, { handheld: parseInt(e.target.value) })}>
                                {range(1, 10).map((n) => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </label>
                          </div>
                        )}

                        {/* Internet */}
                        {def.id === 'internet' && (
                          <label className="av-opt-label">
                            Lines
                            <select className="av-select av-select--sm"
                              value={item.amount ?? 1}
                              onChange={(e) => patchItem(def.id, { amount: parseInt(e.target.value) })}>
                              {range(1, 2).map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </label>
                        )}

                        {/* HD camera */}
                        {def.id === 'camera' && (
                          <label className="av-opt-label">
                            Amount
                            <select className="av-select av-select--sm"
                              value={item.amount ?? 1}
                              onChange={(e) => patchItem(def.id, { amount: parseInt(e.target.value) })}>
                              {range(1, 3).map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </label>
                        )}

                        {/* Interpretation system */}
                        {def.id === 'interp' && (
                          <div className="av-item__opt-row">
                            <label className="av-opt-label">
                              Receivers (people)
                              <select className="av-select av-select--sm"
                                value={item.receivers ?? 65}
                                onChange={(e) => patchItem(def.id, { receivers: parseInt(e.target.value) })}>
                                {range(5, 200, 5).map((n) => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </label>
                            <label className="av-opt-label">
                              Booths
                              <select className="av-select av-select--sm"
                                value={item.booths ?? 1}
                                onChange={(e) => patchItem(def.id, { booths: parseInt(e.target.value) })}>
                                {range(1, 5).map((n) => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Supplies & materials */}
          <section className="av-section">
            <h3 className="av-section__title">Supplies & Materials</h3>
            <p className="av-section__hint">Pick an item, set the amount, and add it. Supplies are always listed as 1 day.</p>

            <div className="av-supply-add">
              <select
                className="av-select"
                value={newSupplyName}
                onChange={(e) => setNewSupplyName(e.target.value)}
              >
                {SUPPLY_CATALOG.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value={CUSTOM_SUPPLY}>Other…</option>
              </select>
              {newSupplyName === CUSTOM_SUPPLY && (
                <input
                  className="av-input"
                  placeholder="Item name"
                  value={newSupplyCustom}
                  onChange={(e) => setNewSupplyCustom(e.target.value)}
                />
              )}
              <input
                className="av-input av-supply-add__amount"
                type="number"
                min={1}
                value={newSupplyAmount}
                onChange={(e) => setNewSupplyAmount(parseInt(e.target.value) || 1)}
              />
              <button
                type="button"
                className="av-btn av-supply-add__btn"
                onClick={addSupply}
                disabled={newSupplyName === CUSTOM_SUPPLY && !newSupplyCustom.trim()}
              >
                + Add
              </button>
            </div>

            {supplies.length > 0 && (
              <div className="av-supply-list">
                {supplies.map((s, idx) => (
                  <div key={s.id} className="av-supply-row">
                    <span className="av-supply-row__num">{idx + 1}</span>
                    <span className="av-supply-row__name">{s.name}</span>
                    <input
                      className="av-input av-supply-row__amount"
                      type="number"
                      min={1}
                      value={s.amount}
                      onChange={(e) => updateSupplyAmount(s.id, parseInt(e.target.value) || 1)}
                    />
                    <button
                      type="button"
                      className="av-supply-row__remove"
                      onClick={() => removeSupply(s.id)}
                      aria-label={`Remove ${s.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Export + Save */}
          <div className="av-export-bar">
            <div className="av-filename">📄 {filename}</div>
            {savedAt && (
              <div className="av-saved-chip">
                ✓ Saved{savedBy ? ` by ${savedBy}` : ''} · {new Date(savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {savedAt && setup.eventCode && (
              <Link className="av-financials-link" to={`/event/${setup.eventCode}?tab=financials`}>
                View in Financials →
              </Link>
            )}
            {saveError && <p className="av-save-error">⚠ {saveError}</p>}
            {financialsSyncError && <p className="av-save-error">⚠ Financials sync failed: {financialsSyncError}</p>}
            <div className="av-export-row">
              <button
                className="av-btn av-btn--export"
                onClick={handleExport}
                disabled={exporting || !hasContent}
              >
                {exporting ? '⏳ Generating…' : '⬇ Export Equipment List (.xlsx)'}
              </button>
              {driveLink && (
                <button
                  type="button"
                  className="av-btn av-btn--link"
                  onClick={handleCopyLink}
                  title="Copy Google Drive link to clipboard"
                >
                  {linkCopied ? '✓ Copied!' : '🔗 Link'}
                </button>
              )}
              <button
                type="button"
                className="av-btn av-btn--save"
                onClick={handleSave}
                disabled={saving || !setup.eventCode || !hasContent}
                title={!setup.eventCode ? 'Enter an event code first' : 'Save equipment list to Google Drive'}
              >
                {saving ? '⏳ Saving…' : '💾 Save'}
              </button>
            </div>
            {!hasContent && (
              <p className="av-export-hint">Select at least one equipment item or supply above.</p>
            )}
            {!setup.eventCode && hasContent && (
              <p className="av-export-hint">Enter an event code to enable saving to Google Drive.</p>
            )}
          </div>
        </aside>

        {/* ══ RIGHT PANEL — Live Preview ═══════════════════════════════════════ */}
        <main className="av-panel av-panel--preview">
          <h3 className="av-preview__title">Preview</h3>

          <div className="av-preview-wrap">
            <table className="av-preview-table">
              <thead>
                <tr>
                  <th colSpan={7} className="av-pt__title">
                    <div>{setup.eventCode || 'EVENT'} — {setup.eventCity || 'City'} — Date: {setup.eventDate || '—'}</div>
                    <div className="av-pt__title-sub">
                      Set up: {setup.setupStyle}{setup.pax ? ` — ${setup.pax} PAX` : ''}
                    </div>
                  </th>
                </tr>
                <tr className="av-pt__head">
                  <th>No.</th>
                  <th>Name of the Service and Brief Description</th>
                  <th>Item</th>
                  <th>Day</th>
                  <th>Amt</th>
                  <th>Price / Item</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {!hasContent ? (
                  <tr>
                    <td colSpan={7} className="av-pt__empty">
                      No items selected — check equipment or add supplies on the left to build the list.
                    </td>
                  </tr>
                ) : (
                  <>
                    {enabledItems.length > 0 && (
                      <>
                        <tr className="av-pt__section">
                          <th colSpan={7}>Conference Equipment</th>
                        </tr>
                        {enabledItems.map((item, idx) => (
                          <tr key={item.id} className="av-pt__row">
                            <td className="av-pt__num">{idx + 1}</td>
                            <td className="av-pt__desc">{buildDescription(item)}</td>
                            <td>Item</td>
                            <td>{setup.days}</td>
                            <td>{resolvePreviewAmount(item)}</td>
                            <td>—</td>
                            <td>0</td>
                          </tr>
                        ))}
                      </>
                    )}
                    {supplies.length > 0 && (
                      <>
                        <tr className="av-pt__section">
                          <th colSpan={7}>Conference Supplies and Materials</th>
                        </tr>
                        {supplies.map((s, idx) => (
                          <tr key={s.id} className="av-pt__row">
                            <td className="av-pt__num">{enabledItems.length + idx + 1}</td>
                            <td className="av-pt__desc">{s.name}</td>
                            <td>Item</td>
                            <td>1</td>
                            <td>{s.amount}</td>
                            <td>—</td>
                            <td>0</td>
                          </tr>
                        ))}
                      </>
                    )}
                  </>
                )}
              </tbody>
              {hasContent && (
                <tfoot>
                  {enabledItems.length > 0 && (
                    <tr className="av-pt__footer">
                      <td colSpan={6}>Equipment Total</td>
                      <td>0</td>
                    </tr>
                  )}
                  {supplies.length > 0 && (
                    <tr className="av-pt__footer">
                      <td colSpan={6}>Supplies Total</td>
                      <td>0</td>
                    </tr>
                  )}
                  <tr className="av-pt__footer av-pt__footer--total">
                    <td colSpan={6}>Total Sum (*Taxes and fees Included)</td>
                    <td>0</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function resolvePreviewAmount(item: AVItemState): number {
  switch (item.id) {
    case 'sound':        return 1;
    case 'lcd':          return item.amount ?? 1;
    case 'screen':       return item.amount ?? 1;
    case 'laptop':       return item.amount ?? 1;
    case 'feedback':     return item.amount ?? 1;
    case 'printer':      return item.amount ?? 1;
    case 'mic-fixed':    return item.amount ?? 10;
    case 'mic-head':     return item.amount ?? 1;
    case 'podium':       return 1;
    case 'mic-wireless': return (item.lapel ?? 0) + (item.handheld ?? 0);
    case 'internet':     return item.amount ?? 1;
    case 'camera':       return item.amount ?? 1;
    case 'interp':       return item.booths ?? 1;
    default:             return 1;
  }
}

function formatEventDate(dateStr: string): string {
  return formatIsoDate(dateStr);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function driveFileIdFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const m = url.match(/\/file\/d\/([^/?#]+)/);
  return m?.[1];
}
