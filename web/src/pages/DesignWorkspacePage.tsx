import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchEvents } from '../api/client';
import { useUser } from '../context/UserContext';
import {
  BADGE_PRESETS,
  deleteEventDesign,
  getEventAttendees,
  getEventDesign,
  makeDefaultSetup,
  saveEventAttendees,
  saveEventDesign,
  type BadgePreset,
  type BannerSize,
  type DesignAttendee,
  type DesignSigner,
  type EventDesignSetup,
} from '../utils/designStore';
import {
  exportBanner,
  exportCertificates,
  exportNameBadges,
  exportScreenBanner,
  exportTableTents,
} from '../utils/pdfDesigns';
import type { Event } from '../types';
import './DesignWorkspacePage.css';

// ─── Utility ────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

function parseAttendeeText(raw: string): DesignAttendee[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\t|\s*[|,]\s*/);
      return {
        id: uid(),
        name: parts[0]?.trim() ?? '',
        title: parts[1]?.trim() ?? '',
        organization: parts[2]?.trim() ?? '',
      };
    })
    .filter((a) => a.name);
}

// ─── Mini HTML preview components ───────────────────────────────────────────

// Badge layout (matches pdfDesigns.ts drawBadge):
//   1. Logo zone  — white bg, primary + secondary logos
//   2. Title strip — navy, event title in white
//   3. Body        — white, name (navy bold) / title / org in dark
//   4. Info strip  — navy, "Date | City" in white
function BadgePreview({ setup, sample }: { setup: EventDesignSetup; sample: DesignAttendee }) {
  const scale = 2.5; // mm → px
  const bw = Math.round(setup.badgeWidthMm  * scale);
  const bh = Math.round(setup.badgeHeightMm * scale);

  const logoH  = Math.round(bh * 0.24);
  const titleH = Math.round(bh * 0.14);
  const infoH  = Math.round(bh * 0.14);
  const bodyH  = bh - logoH - titleH - infoH;

  const navy = setup.primaryColor;

  return (
    <div style={{ width: bw, height: bh, border: `1.5px solid ${navy}`, borderRadius: 4, overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column', fontFamily: 'Helvetica, Arial, sans-serif' }}>
      {/* 1. Logo zone */}
      <div style={{ height: logoH, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '0 4px', borderBottom: `1px solid ${navy}` }}>
        {(setup.logos ?? []).length > 0
          ? setup.logos.map((url, i) => (
              <img key={i} src={url} alt="" style={{ height: logoH - 8, maxWidth: bw * 0.35, objectFit: 'contain' }} />
            ))
          : <span style={{ fontSize: 8, color: '#94a3b8', fontStyle: 'italic' }}>Logos / flags</span>}
      </div>
      {/* 2. Title strip */}
      <div style={{ height: titleH, background: navy, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
        <span style={{ color: '#fff', fontSize: Math.max(7, titleH * 0.44), fontWeight: 700, textAlign: 'center', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: bw - 8 }}>
          {setup.title || 'Event Title'}
        </span>
      </div>
      {/* 3. Body */}
      <div style={{ height: bodyH, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 6px', textAlign: 'center', gap: 2 }}>
        <strong style={{ fontSize: Math.min(16, Math.max(9, bh * 0.13)), color: navy, lineHeight: 1.15 }}>
          {sample.name || 'Full Name'}
        </strong>
        {sample.title && (
          <span style={{ fontSize: Math.max(7, bh * 0.08), color: '#2d3748', lineHeight: 1.1 }}>{sample.title}</span>
        )}
        {sample.organization && (
          <span style={{ fontSize: Math.max(6, bh * 0.07), color: '#718096', fontStyle: 'italic', lineHeight: 1.1 }}>{sample.organization}</span>
        )}
      </div>
      {/* 4. Info strip */}
      <div style={{ height: infoH, background: navy, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
        <span style={{ color: '#fff', fontSize: Math.max(6, infoH * 0.38), fontWeight: 600, textAlign: 'center' }}>
          {[setup.dateStr, setup.cityCountry].filter(Boolean).join('  |  ') || 'Date  |  City, Country'}
        </span>
      </div>
    </div>
  );
}

// Table tent preview — matches drawTableTent layout:
//  FRONT (bottom half shown first in preview):
//   title strip (navy) → logo zone (white) → name/title/org (white) → date|city strip (navy)
//  BACK (shown above, dimmed):
//   same content upside-down (represented as faded copy)
function TentPreview({ setup, sample }: { setup: EventDesignSetup; sample: DesignAttendee }) {
  const navy = setup.primaryColor;
  const dateCity = [setup.dateStr, setup.cityCountry].filter(Boolean).join('  |  ');
  const hasLogos = (setup.logos ?? []).length > 0;

  const half = (opacity = 1) => (
    <div style={{ opacity, display: 'flex', flexDirection: 'column' }}>
      {/* title strip */}
      <div style={{ background: navy, padding: '4px 10px', textAlign: 'center' }}>
        <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>{setup.title || 'Event Title'}</span>
      </div>
      {/* logos */}
      {hasLogos && (
        <div style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid #e2e8f0' }}>
          {setup.logos.map((url, i) => (
            <img key={i} src={url} alt="" style={{ height: 18, maxWidth: 50, objectFit: 'contain' }} />
          ))}
        </div>
      )}
      {/* body */}
      <div style={{ background: '#fff', padding: '12px 16px', textAlign: 'center', minHeight: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <strong style={{ fontSize: 17, color: navy }}>{sample.name || 'Full Name'}</strong>
        {sample.title && <span style={{ fontSize: 10, color: '#2d3748' }}>{sample.title}</span>}
        {sample.organization && <span style={{ fontSize: 9, color: '#718096', fontStyle: 'italic' }}>{sample.organization}</span>}
      </div>
      {/* info strip */}
      <div style={{ background: navy, padding: '4px 10px', textAlign: 'center' }}>
        <span style={{ color: '#fff', fontSize: 7, fontWeight: 600 }}>{dateCity || 'Date  |  City, Country'}</span>
      </div>
    </div>
  );

  return (
    <div style={{ width: 320, border: `1.5px solid ${navy}`, borderRadius: 6, overflow: 'hidden' }}>
      {half(0.45)}
      <div style={{ height: 1, background: '#cbd5e1', borderTop: '1px dashed #94a3b8', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%) translateY(-50%)', background: '#f8fafc', padding: '0 6px', fontSize: 8, color: '#94a3b8' }}>fold</span>
      </div>
      {half(1)}
    </div>
  );
}

function CertPreview({ setup, sample }: { setup: EventDesignSetup; sample: DesignAttendee }) {
  return (
    <div className="dp-preview__cert" style={{ width: 380, border: `3px solid ${setup.primaryColor}`, borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
      <div style={{ background: setup.primaryColor, padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {(setup.logos ?? []).length > 0
          ? setup.logos.map((url, i) => <img key={i} src={url} alt="" style={{ height: 20, maxWidth: 60, objectFit: 'contain' }} />)
          : <span style={{ color: '#fff', fontSize: 10 }}>LOGOS</span>}
      </div>
      <div style={{ padding: '14px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: setup.primaryColor, letterSpacing: '0.04em' }}>CERTIFICATE OF PARTICIPATION</div>
        <div style={{ height: 1, background: setup.accentColor, margin: '8px auto', width: 100 }} />
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>This is to certify that</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '6px 0' }}>{sample.name || 'Full Name'}</div>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>has successfully participated in</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: setup.primaryColor }}>{setup.title || 'Event Title'}</div>
        <div style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>{[setup.cityCountry, setup.dateStr].filter(Boolean).join(' · ')}</div>
        {setup.signers.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12 }}>
            {setup.signers.map((s) => (
              <div key={s.id} style={{ textAlign: 'center', fontSize: 8 }}>
                <div style={{ borderTop: '1px solid #94a3b8', width: 80, marginBottom: 3 }} />
                <strong style={{ color: '#0f172a' }}>{s.name}</strong><br />
                <span style={{ color: '#64748b' }}>{s.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ background: setup.accentColor, padding: '5px', textAlign: 'center' }}>
        <span style={{ color: '#fff', fontSize: 8 }}>{[setup.title, setup.cityCountry, setup.dateStr].filter(Boolean).join(' · ')}</span>
      </div>
    </div>
  );
}

function BannerPreview({ setup }: { setup: EventDesignSetup }) {
  const ratio = setup.bannerSize === '85x200' ? 85 / 200 : 80 / 200;
  const h = 260, w = Math.round(h * ratio);
  return (
    <div style={{ width: w, height: h, border: '1px solid #ddd', borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff', flexShrink: 0 }}>
      <div style={{ background: setup.primaryColor, height: h * 0.07 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 6px', gap: 6, textAlign: 'center' }}>
        {(setup.logos ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
            {setup.logos.map((url, i) => <img key={i} src={url} alt="" style={{ maxWidth: (w - 12) / setup.logos.length, maxHeight: 36, objectFit: 'contain' }} />)}
          </div>
        )}
        <strong style={{ fontSize: 11, color: '#0f172a', lineHeight: 1.3 }}>{setup.title || 'Event Title'}</strong>
        <span style={{ fontSize: 9, color: '#475569' }}>{setup.cityCountry}</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: setup.primaryColor }}>{setup.dateStr}</span>
      </div>
      <div style={{ background: setup.accentColor, height: h * 0.05 }} />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

type Tab = 'setup' | 'attendees' | 'generate';

export function DesignWorkspacePage() {
  const { eventCode = '' } = useParams<{ eventCode: string }>();
  const { user } = useUser();

  const [event, setEvent]             = useState<Event | null>(null);
  const [setup, setSetup]             = useState<EventDesignSetup | null>(null);
  const [attendees, setAttendees]     = useState<DesignAttendee[]>([]);
  const [tab, setTab]                 = useState<Tab>('setup');
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);

  // Attendees tab state
  const [pasteText, setPasteText]     = useState('');
  const [parseError, setParseError]   = useState('');

  // Generate tab state
  const [genBadge, setGenBadge]       = useState(true);
  const [genTent, setGenTent]         = useState(true);
  const [genCert, setGenCert]         = useState(true);
  const [genBanner, setGenBanner]     = useState(false);
  const [genScreen, setGenScreen]     = useState(false);
  const [badgeSheet, setBadgeSheet]   = useState<'A4' | 'A3'>('A4');
  const [generating, setGenerating]   = useState(false);

  // Edit signer modal
  const [editSignerIdx, setEditSignerIdx] = useState<number | null>(null);

  const logoRef1 = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchEvents().then((res) => {
      const ev = res.events.find((e) => e.code === eventCode) ?? null;
      setEvent(ev);

      const existing = getEventDesign(eventCode);
      if (existing) {
        setSetup(existing);
      } else if (ev) {
        setSetup(makeDefaultSetup(
          eventCode,
          ev.location,
          ev.dates,
          ev.location,
          user?.name ?? '',
        ));
      }
      setAttendees(getEventAttendees(eventCode));
    });
  }, [eventCode, user]);

  function updateSetup(patch: Partial<EventDesignSetup>) {
    setSetup((s) => s ? { ...s, ...patch } : s);
    setSaved(false);
  }

  function handleLogoAdd(files: FileList | null) {
    if (!files?.length || !setup) return;
    const readers = Array.from(files).map(
      (file) =>
        new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.readAsDataURL(file);
        }),
    );
    Promise.all(readers).then((urls) => {
      updateSetup({ logos: [...(setup.logos ?? []), ...urls] });
    });
  }

  function handleLogoRemove(idx: number) {
    if (!setup) return;
    updateSetup({ logos: setup.logos.filter((_, i) => i !== idx) });
  }

  function handleLogoReorder(from: number, to: number) {
    if (!setup) return;
    const arr = [...setup.logos];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    updateSetup({ logos: arr });
  }

  async function handleSaveSetup() {
    if (!setup) return;
    setSaving(true);
    const updated = { ...setup, primaryColor: '#203864', accentColor: '#203864', savedAt: new Date().toISOString(), savedBy: user?.name ?? '' };
    saveEventDesign(updated);
    setSetup(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleBadgePreset(preset: BadgePreset) {
    const p = BADGE_PRESETS[preset];
    updateSetup({ badgePreset: preset, badgeWidthMm: p.w, badgeHeightMm: p.h });
  }

  function handlePasteImport() {
    if (!pasteText.trim()) { setParseError('Paste some names first.'); return; }
    const parsed = parseAttendeeText(pasteText);
    if (!parsed.length) { setParseError('Could not parse any names — expected: Name (tab or | or ,) Title (tab|,) Organization'); return; }
    setParseError('');
    const merged = [...attendees, ...parsed];
    setAttendees(merged);
    saveEventAttendees(eventCode, merged);
    setPasteText('');
  }

  function removeAttendee(id: string) {
    const next = attendees.filter((a) => a.id !== id);
    setAttendees(next);
    saveEventAttendees(eventCode, next);
  }

  function updateAttendee(id: string, patch: Partial<DesignAttendee>) {
    const next = attendees.map((a) => a.id === id ? { ...a, ...patch } : a);
    setAttendees(next);
    saveEventAttendees(eventCode, next);
  }

  async function handleGenerate() {
    if (!setup) return;
    setGenerating(true);
    try {
      if (genBadge && attendees.length) await exportNameBadges(setup, attendees, badgeSheet);
      if (genTent  && attendees.length) await exportTableTents(setup, attendees);
      if (genCert  && attendees.length) await exportCertificates(setup, attendees);
      if (genBanner)  await exportBanner(setup);
      if (genScreen)  await exportScreenBanner(setup);
    } finally {
      setGenerating(false);
    }
  }

  const sampleAttendee: DesignAttendee = attendees[0] ?? {
    id: 'preview',
    name: 'Full Name',
    title: 'Participant',
    organization: 'Organization',
  };

  if (!setup) return <div className="dw-loading">Loading…</div>;

  return (
    <div className="dw-page">
      {/* Breadcrumb */}
      <div className="dw-breadcrumb">
        <Link to="/designs">← Designs</Link>
        <span>/</span>
        <span>{eventCode}</span>
        {event && <span className="dw-breadcrumb__event">{event.location} · {event.dates}</span>}
      </div>

      {/* Tabs */}
      <div className="dw-tabs">
        {(['setup', 'attendees', 'generate'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`dw-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'setup'     ? '⚙️ Design Setup'   : ''}
            {t === 'attendees' ? `👥 Attendees${attendees.length ? ` (${attendees.length})` : ''}` : ''}
            {t === 'generate'  ? '🖨️ Generate & Export' : ''}
          </button>
        ))}
      </div>

      {/* ── SETUP TAB ─────────────────────────────────────────────── */}
      {tab === 'setup' && (
        <div className="dw-panel">
          <div className="dw-panel__row dw-panel__row--2col">
            {/* Left: variables */}
            <div className="dw-fields">
              <h2>Event information</h2>
              <label>
                Event / Meeting title
                <input value={setup.title} onChange={(e) => updateSetup({ title: e.target.value })} placeholder="Pre-filled from event" />
              </label>
              <div className="dw-row2">
                <label>
                  Dates
                  <input value={setup.dateStr} onChange={(e) => updateSetup({ dateStr: e.target.value })} placeholder="e.g. June 4–5, 2026" />
                </label>
                <label>
                  City, Country
                  <input value={setup.cityCountry} onChange={(e) => updateSetup({ cityCountry: e.target.value })} placeholder="Colombo, Sri Lanka" />
                </label>
              </div>

              <h2>Branding</h2>
              <div className="dw-brand-locked">
                <span className="dw-brand-swatch" style={{ background: '#203864' }} />
                <span>Brand colour <strong>#203864</strong> — applied to all design templates</span>
                <span className="dw-brand-locked__badge">Locked</span>
              </div>

              <div className="dw-logos-section">
                <p className="dw-hint">Upload logos and/or country flags in display order (left → right). Drag to reorder.</p>
                <div className="dw-logos-grid">
                  {(setup.logos ?? []).map((url, i) => (
                    <div key={i} className="dw-logo-item">
                      <img src={url} alt={`Logo ${i + 1}`} className="dw-logo-item__img" />
                      <div className="dw-logo-item__actions">
                        {i > 0 && (
                          <button type="button" title="Move left" onClick={() => handleLogoReorder(i, i - 1)}>←</button>
                        )}
                        {i < setup.logos.length - 1 && (
                          <button type="button" title="Move right" onClick={() => handleLogoReorder(i, i + 1)}>→</button>
                        )}
                        <button type="button" title="Remove" onClick={() => handleLogoRemove(i)}>✕</button>
                      </div>
                    </div>
                  ))}
                  <label className="dw-logo-add">
                    <span>+</span>
                    <small>Add logo / flag</small>
                    <input ref={logoRef1} type="file" accept="image/*" multiple hidden onChange={(e) => handleLogoAdd(e.target.files)} />
                  </label>
                </div>
              </div>

              <h2>Name badge size</h2>
              <label>
                Badge preset
                <select value={setup.badgePreset} onChange={(e) => handleBadgePreset(e.target.value as BadgePreset)}>
                  {Object.entries(BADGE_PRESETS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </label>
              {setup.badgePreset === 'custom' && (
                <div className="dw-row2">
                  <label>
                    Width (mm)
                    <input type="number" value={setup.badgeWidthMm} min={50} max={200}
                      onChange={(e) => updateSetup({ badgeWidthMm: Number(e.target.value) })} />
                  </label>
                  <label>
                    Height (mm)
                    <input type="number" value={setup.badgeHeightMm} min={30} max={200}
                      onChange={(e) => updateSetup({ badgeHeightMm: Number(e.target.value) })} />
                  </label>
                </div>
              )}

              <h2>Roll-up banner size</h2>
              <label>
                Banner dimensions
                <select value={setup.bannerSize} onChange={(e) => updateSetup({ bannerSize: e.target.value as BannerSize })}>
                  <option value="85x200">85 × 200 cm</option>
                  <option value="80x200">80 × 200 cm</option>
                </select>
              </label>

              <h2>Certificate signers</h2>
              <p className="dw-hint">Add one or more people who will sign the certificates.</p>
              <div className="dw-signers">
                {setup.signers.map((s, i) => (
                  <div key={s.id} className="dw-signer">
                    {editSignerIdx === i ? (
                      <>
                        <input placeholder="Full name" value={s.name} onChange={(e) => {
                          const updated = setup.signers.map((x, j) => j === i ? { ...x, name: e.target.value } : x);
                          updateSetup({ signers: updated });
                        }} />
                        <input placeholder="Title / Position" value={s.title} onChange={(e) => {
                          const updated = setup.signers.map((x, j) => j === i ? { ...x, title: e.target.value } : x);
                          updateSetup({ signers: updated });
                        }} />
                        <button type="button" className="dw-btn dw-btn--sm dw-btn--primary" onClick={() => setEditSignerIdx(null)}>✓ Done</button>
                      </>
                    ) : (
                      <>
                        <span className="dw-signer__name">{s.name || '(No name)'}</span>
                        <span className="dw-signer__title">{s.title}</span>
                        <button type="button" className="dw-btn dw-btn--sm dw-btn--ghost" onClick={() => setEditSignerIdx(i)}>Edit</button>
                        <button type="button" className="dw-btn dw-btn--sm dw-btn--danger" onClick={() => {
                          updateSetup({ signers: setup.signers.filter((_, j) => j !== i) });
                          if (editSignerIdx === i) setEditSignerIdx(null);
                        }}>✕</button>
                      </>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="dw-btn dw-btn--sm dw-btn--secondary"
                  onClick={() => {
                    const newSigner: DesignSigner = { id: uid(), name: '', title: '' };
                    updateSetup({ signers: [...setup.signers, newSigner] });
                    setEditSignerIdx(setup.signers.length);
                  }}
                >
                  + Add signer
                </button>
              </div>

              <div className="dw-fields__footer">
                <button type="button" className="dw-btn dw-btn--primary" onClick={handleSaveSetup} disabled={saving}>
                  {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save design setup'}
                </button>
                {setup.savedAt && (
                  <span className="dw-hint">
                    Last saved {new Date(setup.savedAt).toLocaleString('en-GB', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            </div>

            {/* Right: live previews */}
            <div className="dw-preview-panel">
              <h2>Live preview</h2>
              <div className="dw-preview-section">
                <h3>Name Badge <small>({setup.badgeWidthMm}×{setup.badgeHeightMm} mm)</small></h3>
                <BadgePreview setup={setup} sample={sampleAttendee} />
              </div>
              <div className="dw-preview-section">
                <h3>Table Tent <small>(A4 landscape)</small></h3>
                <TentPreview setup={setup} sample={sampleAttendee} />
              </div>
              <div className="dw-preview-section">
                <h3>Certificate <small>(A4 landscape)</small></h3>
                <CertPreview setup={setup} sample={sampleAttendee} />
              </div>
              <div className="dw-preview-section">
                <h3>Roll-up Banner <small>({setup.bannerSize} cm)</small></h3>
                <BannerPreview setup={setup} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ATTENDEES TAB ─────────────────────────────────────────── */}
      {tab === 'attendees' && (
        <div className="dw-panel">
          <div className="dw-attendees-top">
            <div className="dw-paste-box">
              <h2>Paste / import names</h2>
              <p className="dw-hint">
                Paste one attendee per line. Columns: <code>Name</code> (tab or | or ,) <code>Title</code> (tab|,) <code>Organization</code>
              </p>
              <textarea
                rows={6}
                placeholder={`Jane Smith\tSenior Advisor\tUSAID\nMark Lee\tDirector\tWorld Bank`}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              {parseError && <p className="dw-error">{parseError}</p>}
              <div className="dw-paste-actions">
                <button type="button" className="dw-btn dw-btn--primary" onClick={handlePasteImport}>
                  Add to list
                </button>
                <span className="dw-hint">{attendees.length} attendee{attendees.length !== 1 ? 's' : ''} in list</span>
              </div>
            </div>
          </div>

          {attendees.length > 0 && (
            <div className="dw-attendee-list">
              <div className="dw-attendee-list__header">
                <span>#</span><span>Name</span><span>Title</span><span>Organization</span><span />
              </div>
              {attendees.map((a, i) => (
                <div key={a.id} className="dw-attendee-row">
                  <span className="dw-attendee-row__num">{i + 1}</span>
                  <input
                    value={a.name}
                    placeholder="Name"
                    onChange={(e) => updateAttendee(a.id, { name: e.target.value })}
                  />
                  <input
                    value={a.title}
                    placeholder="Title"
                    onChange={(e) => updateAttendee(a.id, { title: e.target.value })}
                  />
                  <input
                    value={a.organization}
                    placeholder="Organization"
                    onChange={(e) => updateAttendee(a.id, { organization: e.target.value })}
                  />
                  <button type="button" className="dw-btn dw-btn--sm dw-btn--danger" onClick={() => removeAttendee(a.id)}>✕</button>
                </div>
              ))}
              <button
                type="button"
                className="dw-btn dw-btn--sm dw-btn--secondary dw-attendee-list__add"
                onClick={() => {
                  const next = [...attendees, { id: uid(), name: '', title: '', organization: '' }];
                  setAttendees(next);
                  saveEventAttendees(eventCode, next);
                }}
              >
                + Add row
              </button>
              <button
                type="button"
                className="dw-btn dw-btn--sm dw-btn--danger"
                onClick={() => { if (confirm('Clear all attendees?')) { setAttendees([]); saveEventAttendees(eventCode, []); } }}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── GENERATE TAB ─────────────────────────────────────────── */}
      {tab === 'generate' && (
        <div className="dw-panel">
          <div className="dw-gen-layout">
            <div className="dw-gen-options">
              <h2>Select documents to generate</h2>
              <p className="dw-hint">
                {attendees.length === 0
                  ? '⚠️ Add attendees first (Attendees tab) for personalised documents.'
                  : `${attendees.length} attendee${attendees.length !== 1 ? 's' : ''} will be used.`}
              </p>

              <div className="dw-gen-checkboxes">
                <label className="dw-gen-check">
                  <input type="checkbox" checked={genBadge} onChange={(e) => setGenBadge(e.target.checked)} />
                  <span>🪪 Name Badges</span>
                  <small>Name, title & organisation on each badge</small>
                </label>
                {genBadge && (
                  <div className="dw-gen-sub">
                    <label>Print sheet size</label>
                    <div className="dw-sheet-toggle">
                      {(['A4', 'A3'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`dw-sheet-btn${badgeSheet === s ? ' active' : ''}`}
                          onClick={() => setBadgeSheet(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <small className="dw-hint">
                      {(() => {
                        const bw = setup.badgeWidthMm, bh = setup.badgeHeightMm;
                        const [pw, ph] = badgeSheet === 'A4' ? [210, 297] : [297, 420];
                        const m = 12, g = 5;
                        const cols = Math.max(1, Math.floor((pw - 2 * m + g) / (bw + g)));
                        const rows = Math.max(1, Math.floor((ph - 2 * m + g) / (bh + g)));
                        return `${cols} × ${rows} = ${cols * rows} badges per ${badgeSheet} sheet`;
                      })()}
                    </small>
                  </div>
                )}

                <label className="dw-gen-check">
                  <input type="checkbox" checked={genTent} onChange={(e) => setGenTent(e.target.checked)} />
                  <span>🔖 Table Tents</span>
                  <small>A4 landscape, fold in half — one per attendee</small>
                </label>

                <label className="dw-gen-check">
                  <input type="checkbox" checked={genCert} onChange={(e) => setGenCert(e.target.checked)} />
                  <span>📜 Certificates</span>
                  <small>A4 landscape, name only — one per attendee</small>
                </label>

                <label className="dw-gen-check">
                  <input type="checkbox" checked={genBanner} onChange={(e) => setGenBanner(e.target.checked)} />
                  <span>🖼️ Roll-up Banner</span>
                  <small>{setup.bannerSize} cm — event branding only</small>
                </label>

                <label className="dw-gen-check">
                  <input type="checkbox" checked={genScreen} onChange={(e) => setGenScreen(e.target.checked)} />
                  <span>📺 Screen Banner</span>
                  <small>16:9 slide — logo, title, city, dates</small>
                </label>
              </div>

              <div className="dw-gen-footer">
                <button
                  type="button"
                  className="dw-btn dw-btn--primary dw-btn--lg"
                  disabled={generating || (!genBadge && !genTent && !genCert && !genBanner && !genScreen)}
                  onClick={handleGenerate}
                >
                  {generating ? 'Generating…' : '🖨️ Generate PDF(s)'}
                </button>
                {!setup.savedAt && (
                  <p className="dw-error">Save your design setup first before generating.</p>
                )}
              </div>
            </div>

            <div className="dw-gen-preview">
              <h2>Design previews</h2>
              <div className="dw-preview-section">
                <h3>Name Badge</h3>
                <BadgePreview setup={setup} sample={sampleAttendee} />
              </div>
              <div className="dw-preview-section">
                <h3>Table Tent</h3>
                <TentPreview setup={setup} sample={sampleAttendee} />
              </div>
              <div className="dw-preview-section">
                <h3>Certificate</h3>
                <CertPreview setup={setup} sample={sampleAttendee} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Danger zone */}
      {setup.savedAt && (
        <div className="dw-danger">
          <button
            type="button"
            className="dw-btn dw-btn--sm dw-btn--danger"
            onClick={() => {
              if (confirm('Delete the design setup for this event? Attendee list will also be removed.')) {
                deleteEventDesign(eventCode);
                window.location.href = '/designs';
              }
            }}
          >
            Delete design setup
          </button>
        </div>
      )}
    </div>
  );
}
