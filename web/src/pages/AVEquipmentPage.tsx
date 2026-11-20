/**
 * AV Equipment List Generator — design handoff "av-equipment-generator.html".
 *
 * Form on the left (event, conference setup, equipment), live PSA-template preview on the right.
 * Save draft keeps the list in this browser; Download .xlsx downloads the file, saves it to the event's
 * Drive folder (updating the same file on re-export) and syncs the lines to Financials.
 *
 * Route: /av-equipment
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchEvents, peekEvents, saveAVEquipmentToDrive } from '../api/client';
import { avEquipmentToArrayBuffer, exportAVEquipment } from '../utils/exportAVEquipment';
import { loadAVEquipment, saveAVEquipment, type SavedAVEquipment } from '../utils/avEquipmentStore';
import { buildAVCostLines } from '../utils/avFinancialsSync';
import { syncGeneratorCostItems } from '../utils/generatorFinancialsSync';
import { generatorEventLabel, generatorEventOptions } from '../utils/generatorEvents';
import { formatAgo } from '../utils/generatorStatus';
import { useUser } from '../context/UserContext';
import type { Event } from '../types';
import {
  AV_ITEMS,
  BANDWIDTHS,
  BOOTH_OPTIONS,
  DEFAULT_BANDWIDTH,
  LUMENS,
  MAX_DAYS,
  MIC_OPTIONS,
  RECEIVER_OPTIONS,
  SETUP_STYLES,
  type AVItemDef,
  type AVItemState,
  type AVSetup,
  applySuggestion,
  autoLumens,
  avDateLabel,
  avEquipmentFilename,
  avTitleLines,
  blankItems,
  buildAVLines,
  fileDayFromIso,
  itemSummary,
  normalizeItems,
  paxFromCapacity,
  paxNumber,
  qtyOptions,
  suggestionText,
} from '../utils/avEquipment';
import './AVEquipmentPage.css';

type Status = 'new' | 'dirty' | 'saved' | 'exported';

/** The Drive file an export updates — only for the event it was saved for. */
interface DriveMeta {
  code: string;
  url: string | null;
  fileId: string | null;
}

const NO_DRIVE: DriveMeta = { code: '', url: null, fileId: null };

function setupFromEvent(ev: Event, keep: Pick<AVSetup, 'setupStyle' | 'days'>): AVSetup {
  return {
    eventCode: ev.code,
    eventRowId: ev.rowId ?? '',
    eventCity: ev.location ?? '',
    eventDate: avDateLabel(ev.startDate, ev.endDate) || ev.dates || '',
    fileDay: fileDayFromIso(ev.startDate),
    setupStyle: keep.setupStyle,
    pax: paxFromCapacity(ev.capacity),
    days: keep.days,
  };
}

function driveFileIdFromUrl(url: string | undefined): string | undefined {
  return url?.match(/\/file\/d\/([^/?#]+)/)?.[1];
}

function driveFromSaved(code: string, saved: SavedAVEquipment): DriveMeta {
  const fileId = saved.driveFileId || driveFileIdFromUrl(saved.driveUrl) || null;
  const url = saved.driveUrl || (fileId ? `https://drive.google.com/file/d/${fileId}/view?usp=sharing` : null);
  return { code, url, fileId };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

interface Opt {
  v: string | number;
  t: string;
}

/** Options plus the current value when it isn't one of them (lists saved before the redesign). */
function withCurrent(opts: Opt[], value: string | number, label: (v: string | number) => string): Opt[] {
  return opts.some((o) => String(o.v) === String(value)) ? opts : [...opts, { v: value, t: label(value) }];
}

function SelectField(props: {
  id: string;
  label: string;
  value: string | number;
  options: Opt[];
  full?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className={props.full ? 'full' : undefined}>
      <label className="avx-lbl" htmlFor={props.id}>{props.label}</label>
      <select id={props.id} className="avx-inp avx-inp-sm" value={String(props.value)} onChange={(e) => props.onChange(e.target.value)}>
        {props.options.map((o) => (
          <option key={String(o.v)} value={String(o.v)}>{o.t}</option>
        ))}
      </select>
    </div>
  );
}

const nums = (list: number[]): Opt[] => list.map((n) => ({ v: n, t: String(n) }));

function ItemConfig({ def, item, pax, onPatch }: {
  def: AVItemDef;
  item: AVItemState;
  pax: number;
  onPatch: (patch: Partial<AVItemState>) => void;
}) {
  const id = def.id;
  const int = (v: string) => parseInt(v, 10) || 0;
  const paxText = pax || '?';
  const qty = (
    <SelectField id={`q-${id}`} label="Quantity" value={item.amount ?? 1} options={nums(qtyOptions(def))}
      onChange={(v) => onPatch({ amount: int(v) })} />
  );

  switch (def.kind) {
    case 'lumens':
      return (
        <>
          <SelectField id={`opt-${id}`} label="Luminosity" full value={item.luminosity || 0}
            options={withCurrent(
              [{ v: 0, t: `Auto for ${paxText} PAX · ${autoLumens(pax)} lm` }, ...LUMENS.map((l) => ({ v: l, t: `${l} lm` }))],
              item.luminosity || 0,
              (v) => `${v} lm`,
            )}
            onChange={(v) => onPatch({ luminosity: int(v) })} />
          {qty}
        </>
      );
    case 'screen':
      return (
        <>
          <SelectField id={`opt-${id}`} label={def.sizeLabel ?? 'Size'} full value={item.screenSize ?? ''}
            options={withCurrent(
              [{ v: '', t: `Auto for ${paxText} PAX · ${def.autoSize!(pax)}` }, ...def.sizes!.map((s) => ({ v: s, t: s }))],
              item.screenSize ?? '',
              (v) => `${v} m`,
            )}
            onChange={(v) => onPatch({ screenSize: v })} />
          {qty}
        </>
      );
    case 'net':
      return (
        <SelectField id={`opt-${id}`} label="Bandwidth" full value={item.bandwidth || DEFAULT_BANDWIDTH}
          options={BANDWIDTHS.map((b) => ({ v: b, t: b }))} onChange={(v) => onPatch({ bandwidth: v })} />
      );
    case 'wireless': {
      const total = (item.lapel ?? 0) + (item.handheld ?? 0);
      return (
        <>
          <SelectField id={`b-${id}`} label="Lapel mics" value={item.lapel ?? 0} options={nums(MIC_OPTIONS)}
            onChange={(v) => onPatch({ lapel: int(v) })} />
          <SelectField id={`a-${id}`} label="Wireless handheld" value={item.handheld ?? 0} options={nums(MIC_OPTIONS)}
            onChange={(v) => onPatch({ handheld: int(v) })} />
          <div className="avx-note">Total on the list: {total} microphone{total === 1 ? '' : 's'}</div>
        </>
      );
    }
    case 'si':
      return (
        <>
          <SelectField id={`b-${id}`} label="Receivers (people)" value={item.receivers ?? 10}
            options={withCurrent(nums(RECEIVER_OPTIONS), item.receivers ?? 10, String)}
            onChange={(v) => onPatch({ receivers: int(v) })} />
          <SelectField id={`a-${id}`} label="Booths" value={item.booths ?? 1}
            options={withCurrent(nums(BOOTH_OPTIONS), item.booths ?? 1, String)}
            onChange={(v) => onPatch({ booths: int(v) })} />
        </>
      );
    case 'fixed':
      return <div className="avx-note">Always 1 — one podium per room.</div>;
    default:
      return qty;
  }
}

export function AVEquipmentPage() {
  const [sp, setSp] = useSearchParams();
  const { user } = useUser();
  const urlCode = sp.get('code');

  // Restore this browser's saved list for the event in the URL before the first paint.
  const [initial] = useState(() => {
    const saved = urlCode ? loadAVEquipment(urlCode) : null;
    return { saved, code: urlCode ?? '' };
  });

  const [setup, setSetup] = useState<AVSetup>(() =>
    initial.saved
      ? { ...initial.saved.setup, days: initial.saved.setup.days || 1 }
      : {
          eventCode: urlCode ?? '',
          eventRowId: '',
          eventCity: sp.get('city') ?? '',
          eventDate: sp.get('dates') ?? '',
          setupStyle: 'Classroom',
          pax: '',
          days: 1,
        },
  );
  const [items, setItems] = useState<AVItemState[]>(() => normalizeItems(initial.saved?.items));
  const [status, setStatus] = useState<Status>(() =>
    initial.saved ? (initial.saved.driveUrl || initial.saved.driveFileId ? 'exported' : 'saved') : 'new',
  );
  const [statusAt, setStatusAt] = useState<string | null>(initial.saved?.savedAt ?? null);
  const [statusBy, setStatusBy] = useState(initial.saved?.savedBy ?? '');
  const [drive, setDrive] = useState<DriveMeta>(() => (initial.saved ? driveFromSaved(initial.code, initial.saved) : NO_DRIVE));
  const [exporting, setExporting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [financialsError, setFinancialsError] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>(() => peekEvents()?.events ?? []);
  const [eventsLoaded, setEventsLoaded] = useState(() => !!peekEvents());

  useEffect(() => {
    let cancelled = false;
    fetchEvents()
      .then((res) => {
        if (!cancelled) setEvents(res.events ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEventsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => generatorEventOptions(events, urlCode), [events, urlCode]);
  const pax = paxNumber(setup.pax);
  const lines = useMemo(() => buildAVLines(setup, items), [setup, items]);
  const fileName = avEquipmentFilename(setup);
  const onCount = items.filter((it) => it.enabled).length;
  const selectedEvent = options.find((ev) => ev.code === setup.eventCode) ?? null;

  // Once events load: fill in what the URL couldn't give (row id, PAX, file day), or start on the first event.
  const [seeded, setSeeded] = useState(false);
  if (!seeded && options.length > 0) {
    setSeeded(true);
    const ev = setup.eventCode ? options.find((e) => e.code === setup.eventCode) : options[0];
    if (ev && !setup.eventCode) applyEvent(ev);
    else if (ev && initial.saved) {
      // Older saved lists have no row id (needed for the Financials sync).
      if (!setup.eventRowId && ev.rowId) setSetup((s) => ({ ...s, eventRowId: ev.rowId ?? '' }));
    } else if (ev && status === 'new') setSetup((s) => setupFromEvent(ev, s));
  }

  function markDirty() {
    setStatus('dirty');
  }

  function patchSetup(patch: Partial<AVSetup>) {
    setSetup((s) => ({ ...s, ...patch }));
    markDirty();
  }

  function patchItem(id: string, patch: Partial<AVItemState>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    markDirty();
  }

  function pickEvent(code: string) {
    const ev = events.find((e) => e.code === code);
    if (!ev) return;
    const next = new URLSearchParams(sp);
    next.set('code', ev.code);
    next.delete('city');
    next.delete('dates');
    setSp(next, { replace: true });
    applyEvent(ev);
  }

  /** Load this browser's saved list for the event, or take the event's details and keep the equipment chosen so far. */
  function applyEvent(ev: Event) {
    setSaveError(null);
    setFinancialsError(null);
    const saved = loadAVEquipment(ev.code);
    if (saved) {
      setSetup({ ...saved.setup, eventRowId: saved.setup.eventRowId || ev.rowId || '', days: saved.setup.days || 1 });
      setItems(normalizeItems(saved.items));
      setStatus(saved.driveUrl || saved.driveFileId ? 'exported' : 'saved');
      setStatusAt(saved.savedAt);
      setStatusBy(saved.savedBy);
      setDrive(driveFromSaved(ev.code, saved));
      return;
    }
    setSetup((s) => setupFromEvent(ev, s));
    setDrive(NO_DRIVE);
    setStatusAt(null);
    setStatusBy('');
    setStatus(items.some((it) => it.enabled) ? 'dirty' : 'new');
  }

  function clearAll() {
    setItems(blankItems());
    setStatus('new');
  }

  function persist(driveMeta: DriveMeta, at: string) {
    const name = user?.name ?? 'Unknown';
    const prior = loadAVEquipment(setup.eventCode);
    saveAVEquipment(setup.eventCode, {
      setup,
      items,
      // Supplies moved to their own generator; keep anything already saved here so it isn't lost.
      supplies: prior?.supplies,
      savedAt: at,
      savedBy: name,
      savedByEmail: user?.email ?? '',
      driveUrl: driveMeta.code === setup.eventCode ? driveMeta.url ?? undefined : undefined,
      driveFileId: driveMeta.code === setup.eventCode ? driveMeta.fileId ?? undefined : undefined,
    });
    setStatusAt(at);
    setStatusBy(name);
  }

  function saveDraft() {
    if (!setup.eventCode.trim()) return;
    persist(drive, new Date().toISOString());
    setStatus('saved');
  }

  async function downloadXlsx() {
    if (lines.length === 0 || exporting) return;
    exportAVEquipment(setup, items);
    if (!setup.eventCode.trim()) {
      setStatus('exported');
      setStatusAt(new Date().toISOString());
      return;
    }

    setExporting(true);
    setSaveError(null);
    setFinancialsError(null);
    const name = user?.name ?? 'Unknown';
    const email = user?.email ?? '';
    const sameEvent = drive.code === setup.eventCode;
    let nextDrive: DriveMeta = sameEvent ? drive : NO_DRIVE;
    try {
      const result = await saveAVEquipmentToDrive({
        eventCode: setup.eventCode,
        fileName,
        dataBase64: arrayBufferToBase64(avEquipmentToArrayBuffer(setup, items)),
        uploadedBy: name,
        actorEmail: email,
        eventLocation: setup.eventCity,
        driveFileId: nextDrive.fileId ?? undefined,
      });
      nextDrive = { code: setup.eventCode, url: result.driveUrl, fileId: result.driveFileId };
      setDrive(nextDrive);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save to Google Drive');
    }
    persist(nextDrive, new Date().toISOString());
    setStatus('exported');

    try {
      await syncGeneratorCostItems(setup.eventCode, setup.eventRowId, buildAVCostLines(setup, items), email);
    } catch (e) {
      setFinancialsError(e instanceof Error ? e.message : 'Could not sync to Financials');
    }
    setExporting(false);
  }

  const statusLabel =
    status === 'new'
      ? onCount ? 'Unsaved changes' : 'New'
      : status === 'dirty'
        ? 'Unsaved changes'
        : status === 'saved'
          ? 'Draft saved'
          : (() => {
              const ago = formatAgo(statusAt ?? undefined);
              return !ago || ago === 'just now' ? 'Exported just now' : `Exported ${ago}`;
            })();
  const statusTitle = statusAt && (status === 'saved' || status === 'exported')
    ? `${status === 'saved' ? 'Saved' : 'Exported'}${statusBy ? ` by ${statusBy}` : ''} · ${new Date(statusAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : undefined;
  const [titleLine, subLine] = avTitleLines(setup);
  const driveUrl = drive.code === setup.eventCode ? drive.url : null;

  return (
    <div className="avx">
      <div className="avx-titlebar">
        <div className="avx-titlebar__left">
          <div className="avx-tile" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path d="M8 20h8M12 16v4" />
              <path d="M10 8.5v3l3-1.5z" />
            </svg>
          </div>
          <div className="avx-titlebar__name">
            <Link className="avx-back" to={setup.eventCode ? `/generators?code=${encodeURIComponent(setup.eventCode)}` : '/generators'}>
              ← Generators
            </Link>
            <h1>AV Equipment List</h1>
          </div>
          <span
            className={`avx-status${status === 'saved' ? ' is-saved' : status === 'exported' ? ' is-exported' : ''}`}
            role="status"
            title={statusTitle}
          >
            {statusLabel}
          </span>
        </div>
        <div className="avx-actions">
          <button type="button" className="avx-btn avx-btn--secondary" onClick={clearAll}>Clear all</button>
          <button
            type="button"
            className="avx-btn avx-btn--secondary"
            onClick={saveDraft}
            disabled={!setup.eventCode.trim()}
            title={setup.eventCode.trim() ? 'Keep this list in this browser' : 'Enter an event code first'}
          >
            Save draft
          </button>
          <button
            type="button"
            className="avx-btn avx-btn--primary"
            onClick={downloadXlsx}
            disabled={lines.length === 0 || exporting}
            title={setup.eventCode.trim() ? 'Download the .xlsx and save it to the event’s Drive folder' : undefined}
          >
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
            </svg>
            {exporting ? 'Saving to Drive…' : 'Download .xlsx'}
          </button>
        </div>
      </div>

      {(saveError || financialsError) && (
        <div className="avx-alert" role="alert">
          {saveError && <p>The file downloaded, but saving it to Google Drive failed: {saveError}</p>}
          {financialsError && <p>Financials sync failed: {financialsError}</p>}
        </div>
      )}

      <div className="avx-layout">
        {/* ── Form ── */}
        <form className="avx-form" aria-label="AV equipment list settings" onSubmit={(e) => e.preventDefault()}>
          <section className="avx-card">
            <h2 className="avx-sec-h">1 · Event</h2>
            <label className="avx-lbl" htmlFor="av-event">Active event</label>
            <select
              id="av-event"
              className="avx-inp avx-inp--event"
              value={selectedEvent ? selectedEvent.code : ''}
              onChange={(e) => pickEvent(e.target.value)}
            >
              {!selectedEvent && (
                <option value="">
                  {options.length ? '— Pick an event —' : eventsLoaded ? 'No active events — fill in the fields below' : 'Loading events…'}
                </option>
              )}
              {options.map((ev) => (
                <option key={ev.code} value={ev.code}>{generatorEventLabel(ev)}</option>
              ))}
            </select>
            <div className="avx-grid-3">
              <div>
                <label className="avx-lbl" htmlFor="av-code">Code</label>
                <input id="av-code" className="avx-inp" value={setup.eventCode} onChange={(e) => patchSetup({ eventCode: e.target.value })} />
              </div>
              <div>
                <label className="avx-lbl" htmlFor="av-city">City</label>
                <input id="av-city" className="avx-inp" value={setup.eventCity} onChange={(e) => patchSetup({ eventCity: e.target.value })} />
              </div>
              <div>
                <label className="avx-lbl" htmlFor="av-date">Date</label>
                <input
                  id="av-date"
                  className="avx-inp"
                  value={setup.eventDate}
                  // A typed date names the file from the text instead of the event's start day.
                  onChange={(e) => patchSetup({ eventDate: e.target.value, fileDay: '' })}
                />
              </div>
            </div>
          </section>

          <section className="avx-card">
            <h2 className="avx-sec-h">2 · Conference setup</h2>
            <div className="avx-lbl" id="setup-lbl">Setup style</div>
            <div className="avx-pills" role="group" aria-labelledby="setup-lbl">
              {SETUP_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="avx-pill"
                  aria-pressed={s === setup.setupStyle}
                  onClick={() => patchSetup({ setupStyle: s })}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="avx-grid-2">
              <div>
                <label className="avx-lbl" htmlFor="av-pax">PAX (capacity)</label>
                <input
                  id="av-pax"
                  className="avx-inp"
                  type="number"
                  min={1}
                  value={setup.pax}
                  onChange={(e) => patchSetup({ pax: e.target.value })}
                />
              </div>
              <div>
                <div className="avx-lbl" id="days-lbl">Days AV needed</div>
                <div className="avx-stepper" role="group" aria-labelledby="days-lbl">
                  <button type="button" aria-label="Fewer days" onClick={() => patchSetup({ days: Math.max(1, setup.days - 1) })}>−</button>
                  <output aria-live="polite">{setup.days} day{setup.days === 1 ? '' : 's'}</output>
                  <button type="button" aria-label="More days" onClick={() => patchSetup({ days: Math.min(MAX_DAYS, setup.days + 1) })}>+</button>
                </div>
              </div>
            </div>
          </section>

          <section className="avx-card">
            <div className="avx-card__head">
              <h2 className="avx-sec-h">3 · Equipment</h2>
              <span className="avx-count">{onCount} of {AV_ITEMS.length} selected</span>
            </div>
            <div className="avx-suggest">
              <span>{suggestionText(setup.setupStyle, pax)}</span>
              <button
                type="button"
                onClick={() => {
                  setItems((prev) => applySuggestion(prev, setup.setupStyle, pax));
                  markDirty();
                }}
              >
                Apply suggestion
              </button>
            </div>
            <div className="avx-items">
              {AV_ITEMS.map((def, idx) => {
                const item = items.find((it) => it.id === def.id)!;
                return (
                  <div key={def.id} className={`avx-item${item.enabled ? ' is-on' : ''}`}>
                    <div className="avx-item__head">
                      <input
                        type="checkbox"
                        id={`cb-${def.id}`}
                        checked={item.enabled}
                        onChange={(e) => patchItem(def.id, { enabled: e.target.checked })}
                      />
                      <label htmlFor={`cb-${def.id}`}>
                        <span className="avx-item__n">{idx + 1}</span>
                        <span className="avx-item__name">{def.name}</span>
                      </label>
                      <span className="avx-item__sum">{itemSummary(item, pax)}</span>
                    </div>
                    {item.enabled && (
                      <div className="avx-item__cfg">
                        <ItemConfig def={def} item={item} pax={pax} onPatch={(patch) => patchItem(def.id, patch)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="avx-footnote">
              Folders, table tents, notepads and other supplies have their own generator:{' '}
              <Link to={`/supplies-materials${setup.eventCode ? `?code=${encodeURIComponent(setup.eventCode)}` : ''}`}>
                Supplies &amp; Materials →
              </Link>
            </p>
          </section>
        </form>

        {/* ── Preview ── */}
        <section className="avx-card avx-preview" aria-label="Preview">
          <div className="avx-preview__head">
            <h2 className="avx-sec-h">Preview</h2>
            <span className="avx-filename">{fileName}</span>
            <span className="avx-count"><strong>{lines.length}</strong> line{lines.length === 1 ? '' : 's'}</span>
          </div>
          <div className="avx-scroll-x">
            <div className="avx-psa" role="table" aria-label="Equipment list preview">
              <div className="avx-psa-band avx-psa-title" role="row">
                <div role="columnheader">
                  <div className="t">{titleLine}</div>
                  <div className="s">{subLine}</div>
                </div>
              </div>
              <div className="avx-psa-row is-head" role="row">
                <div className="c num" role="columnheader">No.</div>
                <div className="c" role="columnheader">Name of the Service and Brief Description</div>
                <div className="c num" role="columnheader">Item</div>
                <div className="c num" role="columnheader">Day</div>
                <div className="c num" role="columnheader">Amt</div>
                <div className="c num" role="columnheader">Price / Item</div>
                <div className="c num" role="columnheader">Total</div>
              </div>
              <div className="avx-psa-band avx-psa-section" role="row"><span role="cell">Conference Equipment</span></div>
              {lines.length ? (
                <>
                  {lines.map((r) => (
                    <div key={r.id} className="avx-psa-row" role="row">
                      <div className="c num b" role="cell">{r.no}</div>
                      <div className="c" role="cell">{r.description}</div>
                      <div className="c num" role="cell">Item</div>
                      <div className="c num" role="cell">{r.day}</div>
                      <div className="c num b" role="cell">{r.amt}</div>
                      <div className="c num" role="cell">—</div>
                      <div className="c num" role="cell">—</div>
                    </div>
                  ))}
                  <div className="avx-psa-total is-equipment" role="row">
                    <div className="c" role="cell">Equipment Total</div>
                    <div className="c num" role="cell">—</div>
                  </div>
                  <div className="avx-psa-total is-sum" role="row">
                    <div className="c" role="cell">Total Sum (*Taxes and fees included)</div>
                    <div className="c num" role="cell">—</div>
                  </div>
                </>
              ) : (
                <div className="avx-psa-empty" role="row">
                  <span role="cell">No equipment yet — tick items on the left, or apply the suggestion for this setup.</span>
                </div>
              )}
            </div>
          </div>
          <p className="avx-price-note">Prices are left blank for now — the vendor fills in Price / Item and Total.</p>
          {(driveUrl || (status === 'exported' && setup.eventCode)) && (
            <p className="avx-links">
              {driveUrl && (
                <a href={driveUrl} target="_blank" rel="noreferrer">Open in Drive ↗</a>
              )}
              {setup.eventCode && status === 'exported' && (
                <Link to={`/event/${encodeURIComponent(setup.eventCode)}?tab=financials`}>View in Financials →</Link>
              )}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
