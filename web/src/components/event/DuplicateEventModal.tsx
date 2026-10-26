import { useState } from 'react';
import { duplicateEvent } from '../../api/client';
import type { Event } from '../../types';
import '../NewProjectModal.css';

interface Props {
  event: Event;
  actorEmail: string;
  onDuplicated: (event: Event) => void;
  onClose: () => void;
}

export function DuplicateEventModal({ event, actorEmail, onDuplicated, onClose }: Props) {
  const [code, setCode] = useState(`${event.code}-2`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = code.trim();
    if (!next) return;
    setSaving(true);
    setError(null);
    try {
      const result = await duplicateEvent(event.rowId, event.code, next, actorEmail);
      onDuplicated(result.event);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not duplicate the event');
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <form className="modal-card new-project" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <header>
          <h2>Duplicate {event.code}</h2>
          <p>
            Copies the location, dates, venue, team and task list into a new event that starts as Proposed. Notes, files,
            comments, costs and vendor links are not copied.
          </p>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="new-project__body">
          <div className="new-project__grid">
            <label className="new-project__full">
              Code for the new event
              <input value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            </label>
          </div>
        </div>

        {error && <p className="new-project__err">{error}</p>}

        <footer>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !code.trim()}>
            {saving ? 'Duplicating…' : 'Duplicate event'}
          </button>
        </footer>
      </form>
    </div>
  );
}
