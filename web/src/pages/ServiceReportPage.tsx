/**
 * Service Report Generator
 *
 * Lets a team member pick which cost categories applied to a program, enter
 * the services provided with amount/day/price, and exports a styled .xlsx
 * matching the LEM quote template. Saving also uploads the file to the
 * event's Drive folder and syncs each line into the event's Financials.
 *
 * Route: /service-report
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchEvents, saveServiceReportToDrive, updateEvent } from '../api/client';
import {
  exportServiceReport,
  serviceReportFilename,
  serviceReportToArrayBuffer,
} from '../utils/exportServiceReport';
import { loadServiceReport, saveServiceReport } from '../utils/serviceReportStore';
import { buildServiceReportCostLines } from '../utils/serviceReportFinancialsSync';
import { syncGeneratorCostItems } from '../utils/generatorFinancialsSync';
import { SERVICE_REPORT_CATEGORIES, type ServiceReportCategory } from '../utils/serviceReportCategories';
import { useUser } from '../context/UserContext';
import type { Event } from '../types';
import { formatIsoDate } from '../utils/dateFormat';
import './ServiceReportPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServiceReportSetup {
  eventCode:   string;
  eventRowId:  string;
  eventCity:   string;
  eventDate:   string;
  lemName:     string;
  reportTitle: string;
  currency:    string;
}

export interface ServiceReportLine {
  id:          string;
  description: string;
  itemType:    string;
  day:         number;
  amount:      number;
  price:       number;
}

export interface ServiceReportCategoryState {
  name:    ServiceReportCategory;
  enabled: boolean;
  lines:   ServiceReportLine[];
}

const CURRENCIES = ['USD', 'EUR', 'GBP'];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultCategories(): ServiceReportCategoryState[] {
  return SERVICE_REPORT_CATEGORIES.map((name) => ({ name, enabled: false, lines: [] }));
}

function lineTotal(line: ServiceReportLine): number {
  return line.day * line.amount * line.price;
}

function categoryTotal(cat: ServiceReportCategoryState): number {
  return cat.lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

function formatMoney(n: number, currency: string): string {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

// ─── Page component ───────────────────────────────────────────────────────────

export function ServiceReportPage() {
  const [sp] = useSearchParams();
  const { user } = useUser();

  const [setup, setSetup] = useState<ServiceReportSetup>({
    eventCode:   sp.get('code') ?? '',
    eventRowId:  '',
    eventCity:   sp.get('city') ?? '',
    eventDate:   sp.get('dates') ?? '',
    lemName:     '',
    reportTitle: '',
    currency:    'USD',
  });

  const [categories, setCategories] = useState<ServiceReportCategoryState[]>(defaultCategories);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [savedAt, setSavedAt]     = useState<string | null>(null);
  const [savedBy, setSavedBy]     = useState('');
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [driveFileId, setDriveFileId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [financialsSyncError, setFinancialsSyncError] = useState<string | null>(null);
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

  useEffect(() => {
    const code = sp.get('code');
    if (!code) return;
    const saved = loadServiceReport(code);
    if (!saved) return;
    setSetup(saved.setup);
    setCategories(saved.categories);
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
      eventDate: ev.startDate ? formatIsoDate(ev.startDate) : '',
      reportTitle: s.reportTitle || `${ev.code} — ${ev.location ?? ''}`,
    }));
    const saved = loadServiceReport(ev.code);
    if (saved) {
      setSetup(saved.setup);
      setCategories(saved.categories);
      setSavedAt(saved.savedAt);
      setSavedBy(saved.savedBy);
      applyDriveMeta(saved);
    } else {
      setCategories(defaultCategories());
      setSavedAt(null);
      setSavedBy('');
      setDriveLink(null);
      setDriveFileId(null);
    }
  }

  function patchSetup<K extends keyof ServiceReportSetup>(field: K, value: ServiceReportSetup[K]) {
    setSetup((s) => ({ ...s, [field]: value }));
  }

  function toggleCategory(name: ServiceReportCategory) {
    setCategories((prev) => prev.map((c) => c.name === name ? { ...c, enabled: !c.enabled } : c));
  }

  function addLine(name: ServiceReportCategory) {
    setCategories((prev) => prev.map((c) => c.name === name
      ? { ...c, lines: [...c.lines, { id: uid(), description: '', itemType: 'Item', day: 1, amount: 1, price: 0 }] }
      : c));
  }

  function patchLine(name: ServiceReportCategory, lineId: string, patch: Partial<ServiceReportLine>) {
    setCategories((prev) => prev.map((c) => c.name === name
      ? { ...c, lines: c.lines.map((l) => l.id === lineId ? { ...l, ...patch } : l) }
      : c));
  }

  function removeLine(name: ServiceReportCategory, lineId: string) {
    setCategories((prev) => prev.map((c) => c.name === name
      ? { ...c, lines: c.lines.filter((l) => l.id !== lineId) }
      : c));
  }

  async function handleExport() {
    setExporting(true);
    try {
      exportServiceReport(setup, categories);
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
    const fileName = serviceReportFilename(setup);
    let nextDriveUrl = driveLink;
    let nextDriveFileId = driveFileId;

    try {
      const buffer = serviceReportToArrayBuffer(setup, categories);
      const result = await saveServiceReportToDrive({
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

      if (setup.eventRowId) {
        try {
          await updateEvent(setup.eventRowId, setup.eventCode, {
            serviceReportDriveUrl: result.driveUrl,
            serviceReportDriveFileId: result.driveFileId,
            serviceReportSavedAt: now,
            serviceReportSavedBy: name,
          }, email);
        } catch {
          // Non-fatal: the Drive file itself saved fine — the in-app link on
          // the Event Workspace page just won't reflect this particular save.
        }
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save to Google Drive');
    }

    saveServiceReport(setup.eventCode, {
      setup,
      categories,
      savedAt: now,
      savedBy: name,
      savedByEmail: email,
      driveUrl: nextDriveUrl ?? undefined,
      driveFileId: nextDriveFileId ?? undefined,
    });
    setSavedAt(now);
    setSavedBy(name);

    try {
      await syncGeneratorCostItems(
        setup.eventCode,
        setup.eventRowId,
        buildServiceReportCostLines(categories, setup.currency),
        email,
      );
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

  const included = categories.filter((c) => c.enabled && c.lines.length > 0);
  const hasContent = included.length > 0;
  const grandTotal = included.reduce((sum, c) => sum + categoryTotal(c), 0);
  const filename = serviceReportFilename(setup);

  return (
    <div className="sr-page">
      {/* ── Nav ── */}
      <nav className="sr-nav">
        <Link to="/generators" className="sr-nav__back">← Generators</Link>
        <span className="sr-nav__title">Service Report Generator</span>
      </nav>

      <div className="sr-body">
        {/* ══ LEFT PANEL ═══════════════════════════════════════════════════════ */}
        <aside className="sr-panel sr-panel--left">

          {/* Event picker */}
          <section className="sr-section">
            <h3 className="sr-section__title">Event</h3>
            {events.length > 0 && (
              <label className="sr-label">
                Select active event
                <select
                  className="sr-select"
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
            <div className="sr-grid-3">
              <label className="sr-label">
                Event code
                <input className="sr-input" value={setup.eventCode}
                  onChange={(e) => patchSetup('eventCode', e.target.value)} placeholder="J027" />
              </label>
              <label className="sr-label">
                City
                <input className="sr-input" value={setup.eventCity}
                  onChange={(e) => patchSetup('eventCity', e.target.value)} placeholder="Tbilisi" />
              </label>
              <label className="sr-label">
                Date
                <input className="sr-input" value={setup.eventDate}
                  onChange={(e) => patchSetup('eventDate', e.target.value)} placeholder="June 5" />
              </label>
            </div>
          </section>

          {/* Report details */}
          <section className="sr-section">
            <h3 className="sr-section__title">Report Details</h3>
            <label className="sr-label">
              Report title
              <input className="sr-input" value={setup.reportTitle}
                onChange={(e) => patchSetup('reportTitle', e.target.value)} placeholder="J027 — Tbilisi Workshop" />
            </label>
            <div className="sr-grid-2">
              <label className="sr-label">
                LEM name
                <input className="sr-input" value={setup.lemName}
                  onChange={(e) => patchSetup('lemName', e.target.value)} placeholder="Full name" />
              </label>
              <label className="sr-label">
                Currency
                <select className="sr-select" value={setup.currency}
                  onChange={(e) => patchSetup('currency', e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </div>
          </section>

          {/* Category checklist */}
          <section className="sr-section">
            <h3 className="sr-section__title">Categories & Services</h3>
            <p className="sr-section__hint">Check the categories this program used, then add each service provided.</p>

            <div className="sr-category-list">
              {categories.map((cat, idx) => (
                <div key={cat.name} className={`sr-category ${cat.enabled ? 'sr-category--on' : ''}`}>
                  <label className="sr-category__head">
                    <input
                      type="checkbox"
                      className="sr-category__check"
                      checked={cat.enabled}
                      onChange={() => toggleCategory(cat.name)}
                    />
                    <span className="sr-category__num">{idx + 1}</span>
                    <span className="sr-category__label">{cat.name}</span>
                    {cat.enabled && cat.lines.length > 0 && (
                      <span className="sr-category__subtotal">{formatMoney(categoryTotal(cat), setup.currency)}</span>
                    )}
                  </label>

                  {cat.enabled && (
                    <div className="sr-category__body">
                      {cat.lines.length > 0 && (
                        <div className="sr-line sr-line--header">
                          <span className="sr-line__num" />
                          <span>Description</span>
                          <span>Item</span>
                          <span>Day</span>
                          <span>Amount</span>
                          <span>Price/Item</span>
                          <span>Total</span>
                          <span />
                        </div>
                      )}
                      {cat.lines.map((line, lidx) => (
                        <div key={line.id} className="sr-line">
                          <span className="sr-line__num">{lidx + 1}</span>
                          <input
                            className="sr-input sr-line__desc"
                            placeholder="Service description"
                            value={line.description}
                            onChange={(e) => patchLine(cat.name, line.id, { description: e.target.value })}
                          />
                          <input
                            className="sr-input"
                            placeholder="Item"
                            value={line.itemType}
                            onChange={(e) => patchLine(cat.name, line.id, { itemType: e.target.value })}
                          />
                          <input
                            className="sr-input sr-line__num-field"
                            type="number" min={1}
                            value={line.day}
                            onChange={(e) => patchLine(cat.name, line.id, { day: parseInt(e.target.value) || 1 })}
                          />
                          <input
                            className="sr-input sr-line__num-field"
                            type="number" min={0}
                            value={line.amount}
                            onChange={(e) => patchLine(cat.name, line.id, { amount: parseFloat(e.target.value) || 0 })}
                          />
                          <input
                            className="sr-input sr-line__num-field"
                            type="number" min={0} step="0.01"
                            value={line.price}
                            onChange={(e) => patchLine(cat.name, line.id, { price: parseFloat(e.target.value) || 0 })}
                          />
                          <span className="sr-line__total">{lineTotal(line).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <button
                            type="button"
                            className="sr-line__remove"
                            onClick={() => removeLine(cat.name, line.id)}
                            aria-label={`Remove line ${lidx + 1}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" className="sr-add-line-btn" onClick={() => addLine(cat.name)}>
                        + Add line
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Export + Save */}
          <div className="sr-export-bar">
            <div className="sr-filename">📄 {filename}</div>
            {savedAt && (
              <div className="sr-saved-chip">
                ✓ Saved{savedBy ? ` by ${savedBy}` : ''} · {new Date(savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {savedAt && setup.eventCode && (
              <Link className="sr-financials-link" to={`/event/${setup.eventCode}?tab=financials`}>
                View in Financials →
              </Link>
            )}
            {saveError && <p className="sr-save-error">⚠ {saveError}</p>}
            {financialsSyncError && <p className="sr-save-error">⚠ Financials sync failed: {financialsSyncError}</p>}
            <div className="sr-export-row">
              <button
                className="sr-btn sr-btn--export"
                onClick={handleExport}
                disabled={exporting || !hasContent}
              >
                {exporting ? '⏳ Generating…' : '⬇ Export Report (.xlsx)'}
              </button>
              {driveLink && (
                <button
                  type="button"
                  className="sr-btn sr-btn--link"
                  onClick={handleCopyLink}
                  title="Copy Google Drive link to clipboard"
                >
                  {linkCopied ? '✓ Copied!' : '🔗 Link'}
                </button>
              )}
              <button
                type="button"
                className="sr-btn sr-btn--save"
                onClick={handleSave}
                disabled={saving || !setup.eventCode || !hasContent}
                title={!setup.eventCode ? 'Enter an event code first' : 'Save report to Google Drive'}
              >
                {saving ? '⏳ Saving…' : '💾 Save'}
              </button>
            </div>
            {!hasContent && (
              <p className="sr-export-hint">Check at least one category and add a service line above.</p>
            )}
            {!setup.eventCode && hasContent && (
              <p className="sr-export-hint">Enter an event code to enable saving to Google Drive.</p>
            )}
          </div>
        </aside>

        {/* ══ RIGHT PANEL — Live Preview ═══════════════════════════════════════ */}
        <main className="sr-panel sr-panel--preview">
          <h3 className="sr-preview__title">Preview</h3>

          <div className="sr-preview-wrap">
            <table className="sr-preview-table">
              <thead>
                <tr>
                  <th colSpan={7} className="sr-pt__title">
                    <div>{setup.reportTitle || setup.eventCode || 'EVENT'}</div>
                    <div className="sr-pt__title-sub">LEM: {setup.lemName || '—'}</div>
                  </th>
                </tr>
                <tr className="sr-pt__head">
                  <th>No.</th>
                  <th>Name of the Service and Brief Description</th>
                  <th>Item</th>
                  <th>Day</th>
                  <th>Amount</th>
                  <th>Price / Item</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {!hasContent ? (
                  <tr>
                    <td colSpan={7} className="sr-pt__empty">
                      No services added yet — check a category and add lines on the left to build the report.
                    </td>
                  </tr>
                ) : (
                  <>
                    {(() => {
                      let running = 0;
                      return included.map((cat) => {
                        const startNum = running + 1;
                        running += cat.lines.length;
                        return <PreviewCategory key={cat.name} category={cat} startNum={startNum} />;
                      });
                    })()}
                  </>
                )}
              </tbody>
              {hasContent && (
                <tfoot>
                  <tr className="sr-pt__footer sr-pt__footer--total">
                    <td colSpan={6}>Total Sum (*Taxes and fees Included)</td>
                    <td>{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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

// ─── Preview helpers ──────────────────────────────────────────────────────────

function PreviewCategory({ category, startNum }: { category: ServiceReportCategoryState; startNum: number }) {
  return (
    <>
      <tr className="sr-pt__section">
        <th colSpan={7}>{category.name}</th>
      </tr>
      {category.lines.map((line, idx) => (
        <tr key={line.id} className="sr-pt__row">
          <td className="sr-pt__num">{startNum + idx}</td>
          <td className="sr-pt__desc">{line.description || '—'}</td>
          <td>{line.itemType || 'Item'}</td>
          <td>{line.day}</td>
          <td>{line.amount}</td>
          <td>{line.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td>{lineTotal(line).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      ))}
      <tr className="sr-pt__footer">
        <td colSpan={6}>{category.name} Total</td>
        <td>{categoryTotal(category).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
