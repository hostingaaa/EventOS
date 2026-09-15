/**
 * SOW Event Generator — Admin only
 *
 * Upload a PSA/CLDP LEM Statement of Work PDF, auto-extract event details,
 * review & edit the pre-filled form, and generate the event in one click.
 *
 * Route: /sow-generator  (inside AppLayout, guarded to isAdmin)
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { createEvent, fetchTemplatesWithFiles, updateTask, uploadTaskFile, applyTemplates } from '../api/client';
import { parseSOWPdf } from '../utils/parseSOW';
import type { ParsedSOW } from '../utils/parseSOW';
import type { TaskTemplateWithFiles } from '../types';
import { findSowTask, isTemplateSuggested, resolveTemplateIds } from '../utils/templateMatch';
import { formatDateRange, formatMonthYear } from '../utils/dateFormat';
import { DateInput } from '../components/DateInput';
import { COUNTRY_CITIES, OTHER_CITY, citiesForCountry, matchCountryCity } from '../data/countryCities';
import {
  fetchAndCacheMembers,
  getAssignableMembers,
  type OrgMember,
} from '../utils/roleStore';
import './SOWGeneratorPage.css';

// ─── Drive folder structure preview ──────────────────────────────────────────

const DRIVE_FOLDERS = [
  { icon: '📄', name: 'SOW' },
  { icon: '🎛️', name: 'AV Equipment' },
  { icon: '🚌', name: 'Transfer Lists' },
  { icon: '💰', name: 'Per Diem Forms' },
  { icon: '🎤', name: 'Presentations' },
  { icon: '📝', name: 'Evaluation' },
  { icon: '📂', name: 'Templates' },
  { icon: '📸', name: 'Photos' },
  { icon: '📋', name: 'Registration' },
  { icon: '📊', name: 'Reports' },
];

// Package labels for display
const PKG_LABELS: Record<string, string> = {
  fullLEM:         'Full LEM Support Package',
  minimalLEM:      'Minimal LEM Support Package',
  venue:           'Conference Venue & AV Package',
  interpretation:  'Simultaneous Interpretation',
  language:        'Foreign Language Package',
  printing:        'Supplies & Print Materials',
  travelServices:  'Travel Services',
  perDiem:         'Per Diem Allowances',
  lodging:         'Lodging Arrangement',
  groundTransport: 'Ground Transportation',
  catering:        'Catering',
  registration:    'Conference Registration',
  photography:     'Photography / Videography',
  internet:        'Internet Access',
};

// ─── Page component ───────────────────────────────────────────────────────────

export function SOWGeneratorPage() {
  const { user, isAdmin } = useUser();
  const navigate         = useNavigate();
  const dropRef          = useRef<HTMLDivElement>(null);
  const fileRef          = useRef<HTMLInputElement>(null);

  // ── Parse state ────────────────────────────────────────────────────────────
  const [parsing,   setParsing]   = useState(false);
  const [parsed,    setParsed]    = useState<ParsedSOW | null>(null);
  const [parseErr,  setParseErr]  = useState('');
  const [fileName,  setFileName]  = useState('');
  const [sowFile,   setSowFile]   = useState<File | null>(null);

  // ── Editable event fields ──────────────────────────────────────────────────
  const [code,       setCode]       = useState('');
  const [title,      setTitle]      = useState('');
  const [country,    setCountry]    = useState('');
  const [city,       setCity]       = useState('');
  const [cityOther,  setCityOther]  = useState('');
  const [startDate,  setStartDate]  = useState('');
  const [endDate,    setEndDate]    = useState('');
  const [notes,      setNotes]      = useState('');
  const [venue,      setVenue]      = useState('');
  const [pax,        setPax]        = useState('');
  const [language,   setLanguage]   = useState('');
  const [assignee,   setAssignee]   = useState('');

  // ── Templates ──────────────────────────────────────────────────────────────
  const [templates,         setTemplates]         = useState<TaskTemplateWithFiles[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());

  // ── Team members (org roster — not task assignees) ───────────────────────
  const [members, setMembers] = useState<OrgMember[]>(() => getAssignableMembers());

  // ── Generation ─────────────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState('');

  // ── Derived "City, Country" location string ───────────────────────────────
  const cityForLocation = city === OTHER_CITY ? cityOther.trim() : city;
  const location = country
    ? (cityForLocation ? `${cityForLocation}, ${country}` : country)
    : '';
  const selectedCountryEntry = citiesForCountry(country);

  function handleCountryChange(next: string) {
    setCountry(next);
    setCity('');
    setCityOther('');
  }

  const refreshMembers = () => setMembers(getAssignableMembers());

  // ── Load templates + org members on mount ─────────────────────────────────
  useEffect(() => {
    fetchTemplatesWithFiles()
      .then(setTemplates)
      .catch(() => {});
    refreshMembers();
    fetchAndCacheMembers().finally(refreshMembers);

    const onMembersUpdated = (e: StorageEvent) => {
      if (e.key === 'org_members_v1') refreshMembers();
    };
    window.addEventListener('storage', onMembersUpdated);
    window.addEventListener('focus', refreshMembers);
    return () => {
      window.removeEventListener('storage', onMembersUpdated);
      window.removeEventListener('focus', refreshMembers);
    };
  }, []);

  // Map SOW package suggestions → real template IDs once templates are loaded
  useEffect(() => {
    if (!parsed || templates.length === 0) return;
    setSelectedTemplates(new Set(resolveTemplateIds(parsed.suggestedTemplateIds, templates)));
  }, [parsed, templates]);

  // ── Drag & drop ────────────────────────────────────────────────────────────
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    dropRef.current?.classList.add('sow-drop--over');
  }
  function handleDragLeave() {
    dropRef.current?.classList.remove('sow-drop--over');
  }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dropRef.current?.classList.remove('sow-drop--over');
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') await processFile(file);
  }
  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  }

  // ── Parse PDF ─────────────────────────────────────────────────────────────
  async function processFile(file: File) {
    setParsing(true);
    setParseErr('');
    setParsed(null);
    setFileName(file.name);
    setSowFile(file);
    try {
      const sow = await parseSOWPdf(file);
      setParsed(sow);
      // Pre-fill form fields
      setCode(sow.eventCode);
      setTitle(sow.meetingName);
      const matched = matchCountryCity(sow.location || sow.city);
      setCountry(matched.country);
      setCity(matched.city);
      setCityOther(matched.cityOther);
      setStartDate(sow.startDate);
      setEndDate(sow.endDate);
      setNotes(sow.notes);
      setPax(sow.totalParticipants);
      setLanguage(sow.language);
      setVenue('');
      // Template selection is synced in useEffect once templates load
      setAssignee(user?.email ?? '');
    } catch (err) {
      setParseErr(err instanceof Error ? err.message : 'Failed to parse PDF');
    } finally {
      setParsing(false);
    }
  }

  function toggleTemplate(id: string) {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Generate event ─────────────────────────────────────────────────────────
  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setGenerating(true);
    setGenError('');
    try {
      const dates = formatDateRange(startDate, endDate);
      const templateIds = resolveTemplateIds(Array.from(selectedTemplates), templates);
      let result = await createEvent(
        {
          code:        code.trim(),
          location:    location.trim(),
          startDate,
          endDate:     endDate || startDate,
          dates,
          monthGroup:  formatMonthYear(startDate),
          venue:       venue.trim(),
          ownerEmail:  assignee.trim() || user?.email || '',
          notes:       [title ? `Meeting: ${title}` : '', pax ? `PAX: ${pax}` : '', language ? `Language: ${language}` : '', notes].filter(Boolean).join('\n'),
          templateIds,
        },
        user?.email ?? '',
      );

      // Fallback if the sheet ignored template IDs during create
      if (templateIds.length > 0 && result.tasks.length === 0) {
        try {
          const tasks = await applyTemplates(
            result.event.code,
            result.event.rowId,
            templateIds,
            user?.email ?? '',
          );
          result = { event: result.event, tasks };
        } catch {
          /* applyTemplates may be unavailable until Api.gs is redeployed */
        }
      }

      // Attach the SOW PDF to the SOW task (internal only — not visible to vendors)
      if (sowFile && result.tasks.length > 0) {
        const sowTask = findSowTask(result.tasks);
        if (!sowTask) throw new Error('No tasks were created — cannot attach SOW PDF');

        await updateTask(sowTask.taskId, { vendorVisible: 'no' }, user?.email ?? '');
        try {
          await uploadTaskFile(sowTask.taskId, result.event.code, sowFile, user?.email ?? '');
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : 'Upload failed';
          setGenError(
            `Event ${result.event.code} was created, but the SOW PDF could not be attached (${msg}). ` +
              'Open the event workspace and upload the PDF to the SOW task manually.',
          );
          navigate(`/event/${result.event.code}`);
          return;
        }
      } else if (sowFile && templateIds.length > 0) {
        setGenError(
          `Event ${result.event.code} was created, but no tasks were generated from templates. ` +
            'Open the event, add templates manually, then upload the SOW PDF.',
        );
        navigate(`/event/${result.event.code}`);
        return;
      }

      navigate(`/event/${result.event.code}`);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate event');
    } finally {
      setGenerating(false);
    }
  }

  // ── Admin guard ────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="sow-access-denied">
        <p>This tool is only available to admins.</p>
        <Link to="/">← Back to Events</Link>
      </div>
    );
  }

  const detectedPkgs = parsed
    ? (Object.keys(parsed.packages) as Array<keyof typeof parsed.packages>)
        .filter((k) => parsed.packages[k])
    : [];

  const driveName = code && location
    ? `${code} – ${location}${startDate ? ' – ' + formatDateRange(startDate, endDate) : ''}`
    : '{Event Code} – {City} – {Dates}';

  return (
    <div className="sow-page">
      <header className="sow-header">
        <div className="sow-header__inner">
          <h1 className="sow-header__title">SOW Event Generator</h1>
          <p className="sow-header__sub">
            Upload a CLDP LEM Statement of Work PDF — the system auto-extracts event details,
            dates, location, and recommends task templates. Review, adjust, and generate in one click.
          </p>
        </div>
        <span className="sow-header__badge">Admin only</span>
      </header>

      <div className="sow-body">
        {/* ══ LEFT — Upload + Form ══════════════════════════════════════════════ */}
        <div className="sow-left">

          {/* Step 1: Upload */}
          <section className="sow-section">
            <h2 className="sow-section__title">
              <span className="sow-section__num">1</span>
              Upload SOW PDF
            </h2>

            <div
              className={`sow-drop ${parsing ? 'sow-drop--loading' : ''}`}
              ref={dropRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              aria-label="Upload SOW PDF"
            >
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
              {parsing ? (
                <div className="sow-drop__inner">
                  <span className="sow-drop__spinner" />
                  <span>Parsing SOW…</span>
                </div>
              ) : fileName && parsed ? (
                <div className="sow-drop__inner sow-drop__inner--done">
                  <span className="sow-drop__ok">✓</span>
                  <span className="sow-drop__file">{fileName}</span>
                  <span className="sow-drop__change">Click to replace</span>
                </div>
              ) : (
                <div className="sow-drop__inner">
                  <span className="sow-drop__icon">📄</span>
                  <strong>Drop SOW PDF here</strong>
                  <span className="sow-drop__hint">or click to browse — LEM Statement of Work</span>
                </div>
              )}
            </div>
            {parseErr && <p className="sow-err">{parseErr}</p>}
            {parsed && parsed.warnings.length > 0 && (
              <ul className="sow-warn-list">
                {parsed.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </section>

          {/* Step 2: Detected packages */}
          {parsed && detectedPkgs.length > 0 && (
            <section className="sow-section">
              <h2 className="sow-section__title">
                <span className="sow-section__num">2</span>
                Detected SOW Packages
              </h2>
              <div className="sow-packages">
                {detectedPkgs.map((k) => (
                  <span key={k} className="sow-pkg">
                    <span className="sow-pkg__dot" />
                    {PKG_LABELS[k] ?? k}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Step 3: Event details form */}
          <form onSubmit={handleGenerate} id="sow-form">
            <section className="sow-section">
              <h2 className="sow-section__title">
                <span className="sow-section__num">{parsed ? '3' : '2'}</span>
                Event Details
                {!parsed && <span className="sow-section__optional">(or fill manually)</span>}
              </h2>

              <div className="sow-grid-2">
                <label className="sow-label sow-label--required">
                  Event code
                  <input
                    className="sow-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="J276"
                    required
                  />
                </label>
                <label className="sow-label">
                  Country
                  <select
                    className="sow-input sow-select"
                    value={country}
                    onChange={(e) => handleCountryChange(e.target.value)}
                  >
                    <option value="">— select country —</option>
                    {COUNTRY_CITIES.map((c) => (
                      <option key={c.country} value={c.country}>{c.country}</option>
                    ))}
                  </select>
                </label>
                <label className="sow-label">
                  City
                  <select
                    className="sow-input sow-select"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      if (e.target.value !== OTHER_CITY) setCityOther('');
                    }}
                    disabled={!country}
                  >
                    <option value="">— select city —</option>
                    {selectedCountryEntry?.capital && (
                      <option value={selectedCountryEntry.capital}>{selectedCountryEntry.capital} (capital)</option>
                    )}
                    {selectedCountryEntry?.secondCity && (
                      <option value={selectedCountryEntry.secondCity}>{selectedCountryEntry.secondCity}</option>
                    )}
                    <option value={OTHER_CITY}>Other (type manually)</option>
                  </select>
                </label>
                {city === OTHER_CITY && (
                  <label className="sow-label sow-label--full">
                    City name
                    <input
                      className="sow-input"
                      value={cityOther}
                      onChange={(e) => setCityOther(e.target.value)}
                      placeholder="Enter city name"
                    />
                  </label>
                )}
                <label className="sow-label">
                  Start date
                  <DateInput
                    className="sow-input"
                    value={startDate}
                    onChange={setStartDate}
                  />
                </label>
                <label className="sow-label">
                  End date
                  <DateInput
                    className="sow-input"
                    value={endDate}
                    min={startDate}
                    onChange={setEndDate}
                  />
                </label>
              </div>

              <label className="sow-label" style={{ marginTop: '0.65rem' }}>
                Meeting name / Title
                <input
                  className="sow-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Extracted from SOW"
                />
              </label>

              <div className="sow-grid-3" style={{ marginTop: '0.65rem' }}>
                <label className="sow-label">
                  PAX count
                  <input
                    className="sow-input"
                    type="number"
                    min={1}
                    value={pax}
                    onChange={(e) => setPax(e.target.value)}
                    placeholder="30"
                  />
                </label>
                <label className="sow-label">
                  Language
                  <input
                    className="sow-input"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="French"
                  />
                </label>
                <label className="sow-label">
                  Venue
                  <input
                    className="sow-input"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>

              <label className="sow-label" style={{ marginTop: '0.65rem' }}>
                Notes
                <textarea
                  className="sow-input sow-textarea"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Auto-filled from SOW…"
                />
              </label>
            </section>

            {/* Step 4: Templates */}
            {templates.length > 0 && (
              <section className="sow-section">
                <h2 className="sow-section__title">
                  <span className="sow-section__num">{parsed ? '4' : '3'}</span>
                  Task Templates
                  <span className="sow-section__count">
                    {selectedTemplates.size} / {templates.length} selected
                  </span>
                </h2>
                <p className="sow-section__hint">
                  Templates pre-selected based on detected SOW packages. Each creates a task
                  and copies attached reference files into the event workspace.
                </p>
                <div className="sow-tpl-list">
                  {templates.map(({ template }) => {
                    const suggested = parsed
                      ? isTemplateSuggested(template.templateId, parsed.suggestedTemplateIds, templates)
                      : false;
                    return (
                      <label
                        key={template.templateId}
                        className={`sow-tpl ${selectedTemplates.has(template.templateId) ? 'sow-tpl--on' : ''} ${suggested ? 'sow-tpl--suggested' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="sow-tpl__check"
                          checked={selectedTemplates.has(template.templateId)}
                          onChange={() => toggleTemplate(template.templateId)}
                        />
                        <div className="sow-tpl__body">
                          <span className="sow-tpl__name">{template.title.replace(/\s*—\s*\{\{.*?\}\}/, '')}</span>
                          <span className="sow-tpl__cat">{template.category}</span>
                        </div>
                        {suggested && <span className="sow-tpl__badge">SOW</span>}
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Step 5: Assign + Generate */}
            <section className="sow-section">
              <h2 className="sow-section__title">
                <span className="sow-section__num">{parsed ? '5' : templates.length ? '4' : '3'}</span>
                Assign &amp; Generate
              </h2>

              <label className="sow-label">
                Assign event to
                <select
                  className="sow-input sow-select"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">— No assigned member —</option>
                  {user && (
                    <option value={user.email}>{user.name} (you)</option>
                  )}
                  {members
                    .filter((m) => m.email.toLowerCase() !== user?.email?.toLowerCase())
                    .map((m) => (
                      <option key={m.id} value={m.email}>
                        {m.name} — {m.email}
                        {m.status === 'invited' ? ' (invited)' : ''}
                      </option>
                    ))}
                </select>
              </label>

              {genError && <p className="sow-err sow-err--gen">{genError}</p>}

              <button
                type="submit"
                form="sow-form"
                className="sow-btn-generate"
                disabled={generating || !code.trim()}
              >
                {generating ? (
                  <><span className="sow-drop__spinner sow-drop__spinner--sm" /> Generating…</>
                ) : (
                  '⚡ Generate Event'
                )}
              </button>
              {!code.trim() && (
                <p className="sow-generate-hint">Fill in the event code above to enable generation.</p>
              )}
            </section>
          </form>
        </div>

        {/* ══ RIGHT — Preview ══════════════════════════════════════════════════ */}
        <aside className="sow-preview">
          <h2 className="sow-preview__title">What will be created</h2>

          {/* Event card preview */}
          <div className="sow-preview-card">
            <div className="sow-preview-card__code">{code || '—'}</div>
            <div className="sow-preview-card__name">{title || location || 'New Event'}</div>
            <div className="sow-preview-card__meta">
              {location && <span>📍 {location}</span>}
              {startDate && <span>📅 {formatDateRange(startDate, endDate)}</span>}
              {pax && <span>👥 {pax} PAX</span>}
              {language && <span>🗣 {language}</span>}
            </div>
            {assignee && (
              <div className="sow-preview-card__assignee">
                <span className="sow-preview-card__assignee-label">Assigned to</span>
                <span className="sow-preview-card__assignee-val">
                  {members.find((m) => m.email.toLowerCase() === assignee.toLowerCase())?.name || assignee}
                </span>
              </div>
            )}
          </div>

          {/* Tasks preview */}
          {selectedTemplates.size > 0 && (
            <div className="sow-preview-section">
              <h3 className="sow-preview-section__title">
                Tasks ({selectedTemplates.size})
              </h3>
              <ul className="sow-preview-tasks">
                {templates
                  .filter(({ template }) => selectedTemplates.has(template.templateId))
                  .map(({ template }) => (
                    <li key={template.templateId} className="sow-preview-task">
                      <span className="sow-preview-task__cat">{template.category}</span>
                      <span className="sow-preview-task__title">
                        {template.title.replace(/\s*[—–]\s*\{\{.*?\}\}/g, '').replace(/\{\{.*?\}\}/g, '').trim()}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Drive folder structure */}
          <div className="sow-preview-section">
            <h3 className="sow-preview-section__title">
              Google Drive folder
            </h3>
            <div className="sow-drive-folder">
              <div className="sow-drive-folder__root">
                📁 {driveName}
              </div>
              <ul className="sow-drive-folder__tree">
                {DRIVE_FOLDERS.map((f) => (
                  <li key={f.name}>
                    <span className="sow-drive-folder__branch">└─</span>
                    {f.icon} {f.name}
                  </li>
                ))}
              </ul>
            </div>
            <p className="sow-drive-note">
              Folder structure is previewed here. When connected to Google Drive via the backend,
              the folder will be created automatically on generation.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
