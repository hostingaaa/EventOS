import { useState } from 'react';
import { updateEvent } from '../api/client';
import type { Event } from '../types';
import { expandDateRange, getEventDateRange } from '../utils/calendarDates';
import { formatMonthYear, formatProgramDates } from '../utils/dateFormat';
import { normalizeSupportLevel, type SupportLevel } from '../utils/supportLevel';
import { ProgramDatesPicker } from './ProgramDatesPicker';
import './NewProjectModal.css';

interface Props {
  event: Event;
  actorEmail: string;
  onSaved: (event: Event) => void;
  onClose: () => void;
}

function initialProgramDates(event: Event): string[] {
  const range = getEventDateRange(event);
  return range ? expandDateRange(range.start, range.end) : [];
}

export function EditEventModal({ event, actorEmail, onSaved, onClose }: Props) {
  const [location, setLocation] = useState(event.location ?? '');
  const [programDates, setProgramDates] = useState<string[]>(() => initialProgramDates(event));
  const [venue, setVenue] = useState(event.venue ?? '');
  const [supportLevel, setSupportLevel] = useState<SupportLevel>(() => normalizeSupportLevel(event.supportLevel));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = [...programDates].sort();
  const startDate = sorted[0] ?? '';
  const endDate = sorted[sorted.length - 1] ?? '';
  const datesChanged = sorted.join(',') !== initialProgramDates(event).join(',');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const nextLocation = location.trim();
      const updated = await updateEvent(
        event.rowId,
        event.code,
        {
          location: nextLocation,
          venue: venue.trim(),
          supportLevel,
          // Only rewrite the date fields when the picker was actually touched,
          // so opening and saving never reformats an event's existing dates.
          ...(datesChanged
            ? { startDate, endDate, dates: formatProgramDates(programDates), monthGroup: formatMonthYear(startDate) }
            : {}),
        },
        actorEmail,
      );
      // An older backend ignores fields it doesn't know instead of failing.
      if ((updated.location ?? '').trim() !== nextLocation) {
        onSaved(updated);
        setError('The location was not saved — the backend script needs to be updated. Other changes were saved.');
        return;
      }
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <form className="modal-card new-project" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <header>
          <h2>Edit event {event.code}</h2>
          <p>Change the event&rsquo;s location, dates, venue or support level.</p>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="new-project__body">
          <div className="new-project__grid">
            <label className="new-project__full">
              Location
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
                autoFocus
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
              LEM support level
              <select value={supportLevel} onChange={(e) => setSupportLevel(e.target.value as SupportLevel)}>
                <option value="">— not specified —</option>
                <option value="full">Full Support LEM</option>
                <option value="minimal">Minimum Support LEM</option>
              </select>
            </label>
          </div>
        </div>

        {error && <p className="new-project__err">{error}</p>}

        <footer>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      </form>
    </div>
  );
}
