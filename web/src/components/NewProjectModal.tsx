import { useEffect, useMemo, useState } from 'react';
import {
  createEvent,
  fetchEvents,
  fetchTemplatesWithFiles,
  fetchWorkspace,
} from '../api/client';
import type { Event, TaskTemplateWithFiles } from '../types';
import { formatMonthYear, formatProgramDates } from '../utils/dateFormat';
import { ProgramDatesPicker } from './ProgramDatesPicker';
import './NewProjectModal.css';

interface Props {
  actorEmail: string;
  onCreated: (eventCode: string) => void;
  onClose: () => void;
}

export function NewProjectModal({ actorEmail, onCreated, onClose }: Props) {
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('');
  const [programDates, setProgramDates] = useState<string[]>([]);
  const [venue, setVenue] = useState('');
  const [ownerEmail, setOwnerEmail] = useState(actorEmail);
  const [notes, setNotes] = useState('');

  const [templates, setTemplates] = useState<TaskTemplateWithFiles[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());

  // Cloning state
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [cloneFromCode, setCloneFromCode] = useState<string>('');
  const [cloning, setCloning] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Derived start/end from the picked program dates (backend only stores a range) ──
  const sortedProgramDates = [...programDates].sort();
  const startDate = sortedProgramDates[0] ?? '';
  const endDate   = sortedProgramDates[sortedProgramDates.length - 1] ?? '';

  useEffect(() => {
    fetchTemplatesWithFiles()
      .then((t) => {
        setTemplates(t);
        setSelectedTemplates(new Set(t.map((x) => x.template.templateId)));
      })
      .catch(() => {
        /* templates optional */
      });
    fetchEvents()
      .then((res) => setAllEvents(res.events))
      .catch(() => {
        /* clone optional */
      });
  }, []);

  const cloneSource = useMemo(
    () => allEvents.find((e) => e.code === cloneFromCode) || null,
    [allEvents, cloneFromCode],
  );

  async function applyClone(sourceCode: string) {
    setCloning(true);
    setError(null);
    try {
      const source = allEvents.find((e) => e.code === sourceCode);
      if (!source) return;

      // Copy non-date fields from the source event so the new project
      // inherits venue, owner, notes, etc.
      setLocation(source.location || '');
      setVenue(source.venue || '');
      setOwnerEmail(source.ownerEmail || actorEmail);
      setNotes(source.notes || '');

      // Pre-select the same templates the source event used by inspecting
      // the source's existing tasks.
      try {
        const ws = await fetchWorkspace(source.code, source.rowId);
        const templateIds = new Set(ws.tasks.map((t) => t.templateId).filter(Boolean));
        if (templateIds.size > 0) {
          setSelectedTemplates(templateIds);
        }
      } catch {
        /* workspace fetch is best-effort */
      }
    } finally {
      setCloning(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await createEvent(
        {
          code: code.trim(),
          location: location.trim(),
          startDate,
          endDate: endDate || startDate,
          dates: formatProgramDates(programDates),
          monthGroup: formatMonthYear(startDate),
          venue: venue.trim(),
          ownerEmail: ownerEmail.trim(),
          notes: notes.trim(),
          templateIds: Array.from(selectedTemplates),
        },
        actorEmail,
      );
      onCreated(result.event.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <form
        className="modal-card new-project"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header>
          <h2>New project</h2>
          <p>Create a new event/project. You can pre-select task templates to seed the workspace.</p>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="new-project__body">
          {allEvents.length > 0 && (
            <section className="new-project__clone">
              <label>
                Clone from existing event
                <select
                  value={cloneFromCode}
                  onChange={async (e) => {
                    const next = e.target.value;
                    setCloneFromCode(next);
                    if (next) await applyClone(next);
                  }}
                  disabled={cloning}
                >
                  <option value="">— Start blank —</option>
                  {allEvents.map((ev) => (
                    <option key={ev.rowId} value={ev.code}>
                      {ev.code}
                      {ev.location ? ` — ${ev.location}` : ''}
                      {ev.dates ? ` (${ev.dates})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {cloneSource && (
                <p className="new-project__clone-hint">
                  Copying venue, assigned member, notes, and templates from <strong>{cloneSource.code}</strong>
                  . Adjust the project code and dates below.
                </p>
              )}
            </section>
          )}

          <div className="new-project__grid">
            <label>
              Project code <span className="req">*</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="J182-4"
                required
                autoFocus
              />
            </label>
            <label>
              Location
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Tbilisi"
              />
            </label>
            <label className="new-project__full">
              Program dates
              <ProgramDatesPicker value={programDates} onChange={setProgramDates} />
            </label>
            <label className="new-project__full">
              Venue
              <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Optional" />
            </label>
            <label className="new-project__full">
              Assigned member email
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="who chases this project"
              />
            </label>
            <label className="new-project__full">
              Notes
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything else the team should know"
              />
            </label>
          </div>

          {templates.length > 0 && (
            <section className="new-project__templates">
              <h3>Add tasks from templates</h3>
              <p>Selected templates create tasks and copy attached reference files into each task.</p>
              <ul>
                {templates.map(({ template, files }) => (
                  <li key={template.templateId}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedTemplates.has(template.templateId)}
                        onChange={() => toggleTemplate(template.templateId)}
                      />
                      <div>
                        <strong>{template.title}</strong>
                        <span className="new-project__cat">{template.category}</span>
                        {files.length > 0 && (
                          <span className="new-project__files">{files.length} file(s)</span>
                        )}
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {error && <p className="new-project__err">{error}</p>}

        <footer>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !code.trim()}>
            {saving ? 'Creating…' : 'Create project'}
          </button>
        </footer>
      </form>
    </div>
  );
}
