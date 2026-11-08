/**
 * Supplies & Materials Generator
 *
 * Builds the conference supplies list (folders, table tents, notepads, name badges, or any custom
 * item) for an event and exports it as a styled .xlsx in the PSA template. Saving puts the file in
 * the event's Drive folder and syncs the items into the event's Financials.
 *
 * Route: /supplies-materials
 * Shares its look with the AV Equipment generator, so it reuses that page's stylesheet.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchEvents, saveAVEquipmentToDrive } from '../api/client';
import { useUser } from '../context/UserContext';
import type { Event } from '../types';
import { formatIsoDate } from '../utils/dateFormat';
import { exportSupplies, suppliesToArrayBuffer } from '../utils/exportSupplies';
import { syncGeneratorCostItems } from '../utils/generatorFinancialsSync';
import {
  buildSupplyCostLines,
  CUSTOM_SUPPLY,
  SUPPLY_CATALOG,
  suppliesFilename,
  type SuppliesSetup,
  type SupplyItemState,
} from '../utils/supplies';
import { loadLegacyAVSupplies, loadSupplies, saveSupplies } from '../utils/suppliesStore';
import './AVEquipmentPage.css';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function driveFileIdFromUrl(url: string | undefined): string | undefined {
  const m = url?.match(/\/file\/d\/([^/?#]+)/);
  return m?.[1];
}

interface Known {
  supplies:    SupplyItemState[];
  savedAt:     string | null;
  savedBy:     string;
  driveUrl?:   string;
  driveFileId?: string;
  /** Supplies carried over from the AV Equipment page, not yet saved here. */
  carriedOver: boolean;
  /** The setup stored with a saved list, when there is one. */
  setup?:      SuppliesSetup;
}

/** What's already known for an event: its own saved list, else supplies from the AV page, else nothing. */
function knownFor(code: string): Known {
  const saved = loadSupplies(code);
  if (saved) {
    return { supplies: saved.supplies, savedAt: saved.savedAt, savedBy: saved.savedBy, driveUrl: saved.driveUrl, driveFileId: saved.driveFileId, carriedOver: false, setup: saved.setup };
  }
  const legacy = loadLegacyAVSupplies(code);
  return { supplies: legacy ?? [], savedAt: null, savedBy: '', carriedOver: !!legacy };
}

function driveLinkOf(k: Pick<Known, 'driveUrl' | 'driveFileId'>): { link: string | null; id: string | null } {
  const id = k.driveFileId || driveFileIdFromUrl(k.driveUrl) || null;
  return { link: k.driveUrl || (id ? `https://drive.google.com/file/d/${id}/view?usp=sharing` : null), id };
}

export function SuppliesMaterialsPage() {
  const [sp] = useSearchParams();
  const { user } = useUser();

  // An event opened by link (?code=…) starts with whatever is already known for it.
  const [initial] = useState<Known | null>(() => {
    const code = sp.get('code');
    return code ? knownFor(code) : null;
  });
  const initialDrive = driveLinkOf(initial ?? {});

  const [setup, setSetup] = useState<SuppliesSetup>(
    initial?.setup ?? {
      eventCode:  sp.get('code') ?? '',
      eventRowId: '',
      eventCity:  sp.get('city') ?? '',
      eventDate:  sp.get('dates') ?? '',
    },
  );
  const [supplies, setSupplies] = useState<SupplyItemState[]>(initial?.supplies ?? []);
  const [newName, setNewName] = useState<string>(SUPPLY_CATALOG[0]);
  const [newCustom, setNewCustom] = useState('');
  const [newAmount, setNewAmount] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(initial?.savedAt ?? null);
  const [savedBy, setSavedBy] = useState(initial?.savedBy ?? '');
  const [driveLink, setDriveLink] = useState<string | null>(initialDrive.link);
  const [driveFileId, setDriveFileId] = useState<string | null>(initialDrive.id);
  const [linkCopied, setLinkCopied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [financialsSyncError, setFinancialsSyncError] = useState<string | null>(null);
  /** True while showing supplies carried over from the AV Equipment page, not yet saved here. */
  const [carriedOver, setCarriedOver] = useState(initial?.carriedOver ?? false);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetchEvents()
      .then((res) => {
        const now = Date.now();
        const COMPLETED_MS = 15 * 24 * 60 * 60 * 1000;
        setEvents(
          res.events.filter((ev) => {
            const end = ev.endDate ? new Date(ev.endDate).getTime() : Infinity;
            return now - end < COMPLETED_MS;
          }),
        );
      })
      .catch(() => {});
  }, []);

  function loadFor(code: string) {
    const known = knownFor(code);
    const drive = driveLinkOf(known);
    setSupplies(known.supplies);
    setSavedAt(known.savedAt);
    setSavedBy(known.savedBy);
    setDriveLink(drive.link);
    setDriveFileId(drive.id);
    setCarriedOver(known.carriedOver);
  }

  function pickEvent(code: string) {
    const ev = events.find((e) => e.code === code);
    if (!ev) return;
    setSetup({
      eventCode: ev.code ?? '',
      eventRowId: ev.rowId ?? '',
      eventCity: ev.location ?? '',
      eventDate: ev.startDate ? formatIsoDate(ev.startDate) : '',
    });
    loadFor(ev.code);
  }

  function patchSetup<K extends keyof SuppliesSetup>(field: K, value: SuppliesSetup[K]) {
    setSetup((s) => ({ ...s, [field]: value }));
  }

  function addSupply() {
    const name = newName === CUSTOM_SUPPLY ? newCustom.trim() : newName;
    if (!name) return;
    setSupplies((prev) => [...prev, { id: uid(), name, amount: newAmount > 0 ? newAmount : 1 }]);
    setNewCustom('');
    setNewAmount(1);
  }

  const updateAmount = (id: string, amount: number) =>
    setSupplies((prev) => prev.map((s) => (s.id === id ? { ...s, amount } : s)));
  const removeSupply = (id: string) => setSupplies((prev) => prev.filter((s) => s.id !== id));

  async function handleExport() {
    setExporting(true);
    try {
      exportSupplies(setup, supplies);
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
    let nextDriveUrl = driveLink;
    let nextDriveFileId = driveFileId;

    try {
      const result = await saveAVEquipmentToDrive({
        eventCode: setup.eventCode,
        fileName: suppliesFilename(setup),
        dataBase64: arrayBufferToBase64(suppliesToArrayBuffer(setup, supplies)),
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

    saveSupplies(setup.eventCode, {
      setup,
      supplies,
      savedAt: now,
      savedBy: name,
      savedByEmail: email,
      driveUrl: nextDriveUrl ?? undefined,
      driveFileId: nextDriveFileId ?? undefined,
    });
    setSavedAt(now);
    setSavedBy(name);
    setCarriedOver(false);

    try {
      await syncGeneratorCostItems(setup.eventCode, setup.eventRowId, buildSupplyCostLines(supplies), email);
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

  const hasContent = supplies.length > 0;
  const filename = suppliesFilename(setup);

  return (
    <div className="av-page">
      <nav className="av-nav">
        <Link to="/generators" className="av-nav__back">← Generators</Link>
        <span className="av-nav__title">Supplies &amp; Materials Generator</span>
      </nav>

      <div className="av-body">
        {/* ══ LEFT PANEL ═══════════════════════════════════════════════════════ */}
        <aside className="av-panel av-panel--left">
          <section className="av-section">
            <h3 className="av-section__title">Event</h3>
            {events.length > 0 && (
              <label className="av-label">
                Select active event
                <select className="av-select" value={setup.eventCode} onChange={(e) => pickEvent(e.target.value)}>
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
                <input className="av-input" value={setup.eventCode} onChange={(e) => patchSetup('eventCode', e.target.value)} placeholder="J027" />
              </label>
              <label className="av-label">
                City
                <input className="av-input" value={setup.eventCity} onChange={(e) => patchSetup('eventCity', e.target.value)} placeholder="Tbilisi" />
              </label>
              <label className="av-label">
                Date
                <input className="av-input" value={setup.eventDate} onChange={(e) => patchSetup('eventDate', e.target.value)} placeholder="June 5" />
              </label>
            </div>
          </section>

          <section className="av-section">
            <h3 className="av-section__title">Supplies &amp; Materials</h3>
            <p className="av-section__hint">Pick an item, set the amount, and add it. Supplies are always listed as 1 day.</p>
            {carriedOver && (
              <p className="av-section__hint av-supplies-carried">
                These were entered on the AV Equipment page. Save here to keep them in this generator.
              </p>
            )}

            <div className="av-supply-add">
              <select className="av-select" value={newName} onChange={(e) => setNewName(e.target.value)}>
                {SUPPLY_CATALOG.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value={CUSTOM_SUPPLY}>Other…</option>
              </select>
              {newName === CUSTOM_SUPPLY && (
                <input className="av-input" placeholder="Item name" value={newCustom} onChange={(e) => setNewCustom(e.target.value)} />
              )}
              <input
                className="av-input av-supply-add__amount"
                type="number"
                min={1}
                value={newAmount}
                aria-label="Amount"
                onChange={(e) => setNewAmount(parseInt(e.target.value) || 1)}
              />
              <button
                type="button"
                className="av-btn av-supply-add__btn"
                onClick={addSupply}
                disabled={newName === CUSTOM_SUPPLY && !newCustom.trim()}
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
                      aria-label={`Amount of ${s.name}`}
                      onChange={(e) => updateAmount(s.id, parseInt(e.target.value) || 1)}
                    />
                    <button type="button" className="av-supply-row__remove" onClick={() => removeSupply(s.id)} aria-label={`Remove ${s.name}`}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

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
              <button className="av-btn av-btn--export" onClick={handleExport} disabled={exporting || !hasContent}>
                {exporting ? '⏳ Generating…' : '⬇ Export Supplies List (.xlsx)'}
              </button>
              {driveLink && (
                <button type="button" className="av-btn av-btn--link" onClick={handleCopyLink} title="Copy Google Drive link to clipboard">
                  {linkCopied ? '✓ Copied!' : '🔗 Link'}
                </button>
              )}
              <button
                type="button"
                className="av-btn av-btn--save"
                onClick={handleSave}
                disabled={saving || !setup.eventCode || !hasContent}
                title={!setup.eventCode ? 'Enter an event code first' : 'Save supplies list to Google Drive'}
              >
                {saving ? '⏳ Saving…' : '💾 Save'}
              </button>
            </div>
            {!hasContent && <p className="av-export-hint">Add at least one supply above.</p>}
            {!setup.eventCode && hasContent && <p className="av-export-hint">Enter an event code to enable saving to Google Drive.</p>}
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
                    <td colSpan={7} className="av-pt__empty">No supplies yet — add items on the left to build the list.</td>
                  </tr>
                ) : (
                  <>
                    <tr className="av-pt__section">
                      <th colSpan={7}>Conference Supplies and Materials</th>
                    </tr>
                    {supplies.map((s, idx) => (
                      <tr key={s.id} className="av-pt__row">
                        <td className="av-pt__num">{idx + 1}</td>
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
              </tbody>
              {hasContent && (
                <tfoot>
                  <tr className="av-pt__footer">
                    <td colSpan={6}>Supplies Total</td>
                    <td>0</td>
                  </tr>
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
