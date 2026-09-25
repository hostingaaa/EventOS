import { useState, useMemo, useEffect } from 'react';
import type { Event, EventUpdates } from '../types';
import { StatusChip } from './StatusChip';
import { updateEvent } from '../api/client';
import { useUser } from '../context/UserContext';
import { getAssignableMembers } from '../utils/roleStore';
import { formatEventHeaderDates } from '../utils/calendarDates';
import { parseAssignedTeam, serializeAssignedTeam } from '../utils/teamAssignment';
import { PersonAvatar } from './calendar/PersonAvatar';
import './EventDetail.css';

const LEM_OPTIONS = ['Open', 'Closed', 'Full/Connectmice'];
const AV_OPTIONS = ['Yes', 'No'];
const INTERPRETER_OPTIONS = ['PSA', 'Connectmice', 'NO'];

interface Props {
  event: Event | null;
  onUpdated: (event: Event) => void;
}

function sowHref(sow: string): string | null {
  const s = sow?.trim();
  if (!s || s === '??') return null;
  if (s.startsWith('http')) return s;
  return null;
}

export function EventDetail({ event, onUpdated }: Props) {
  const { user, can } = useUser();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAssign = can('events.assign');
  const assignableMembers = useMemo(() => getAssignableMembers(), []);

  const [teamOrder, setTeamOrder] = useState<string[]>([]);
  useEffect(() => {
    setTeamOrder(parseAssignedTeam(event ?? {}));
  }, [event?.rowId]);

  if (!event) {
    return (
      <div className="detail detail--empty">
        <p>Select an event to view details and update status.</p>
      </div>
    );
  }

  const ev = event;

  async function saveField(updates: EventUpdates) {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateEvent(ev.rowId, ev.code, updates, user?.email);
      onUpdated(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveAssignee(email: string) {
    if (!canAssign) return;
    const next = email.trim();
    if (next === (ev.ownerEmail ?? '').trim()) return;
    await saveField({ ownerEmail: next });
  }

  function toggleTeamMember(email: string) {
    if (!canAssign) return;
    setTeamOrder((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));
  }

  function makeLead(email: string) {
    if (!canAssign) return;
    setTeamOrder((prev) => [email, ...prev.filter((e) => e !== email)]);
  }

  const teamDirty = serializeAssignedTeam(teamOrder) !== (ev.assignedTeam ?? '');

  async function saveTeam() {
    if (!canAssign || !teamDirty) return;
    await saveField({ assignedTeam: serializeAssignedTeam(teamOrder) });
  }

  const sowLink = sowHref(ev.sow);

  return (
    <div className="detail">
      <header className="detail__header">
        <h2>{ev.code}</h2>
        <p>
          {ev.location} · {formatEventHeaderDates(ev)}
        </p>
      </header>

      {error && <p className="detail__error">{error}</p>}
      {saving && <p className="detail__saving">Saving…</p>}

      <section className="detail__section">
        <h3>Status</h3>
        <div className="detail__grid">
          <label>
            LEM
            <select
              value={ev.lem}
              onChange={(e) => saveField({ lem: e.target.value })}
              disabled={saving}
            >
              {LEM_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              {!LEM_OPTIONS.includes(ev.lem) && ev.lem && (
                <option value={ev.lem}>{ev.lem}</option>
              )}
            </select>
            <StatusChip value={ev.lem} kind="lem" />
          </label>

          <label>
            AV
            <select
              value={ev.av}
              onChange={(e) => saveField({ av: e.target.value })}
              disabled={saving}
            >
              {AV_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              {!AV_OPTIONS.includes(ev.av) && ev.av && (
                <option value={ev.av}>{ev.av}</option>
              )}
            </select>
            <StatusChip value={ev.av} kind="av" />
          </label>

          <label>
            Interpreters
            <select
              value={ev.interpreters}
              onChange={(e) => saveField({ interpreters: e.target.value })}
              disabled={saving}
            >
              {INTERPRETER_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
              {!INTERPRETER_OPTIONS.includes(ev.interpreters) && ev.interpreters && (
                <option value={ev.interpreters}>{ev.interpreters}</option>
              )}
            </select>
            <StatusChip value={ev.interpreters} kind="interpreters" />
          </label>

          <label>
            Venue
            <input
              type="text"
              defaultValue={ev.venue}
              placeholder="Venue name"
              onBlur={(e) => {
                if (e.target.value !== ev.venue) saveField({ venue: e.target.value });
              }}
              disabled={saving}
            />
          </label>

          <label>
            PSA/CLDP
            <input
              type="text"
              defaultValue={ev.psaCldp}
              onBlur={(e) => {
                if (e.target.value !== ev.psaCldp) saveField({ psaCldp: e.target.value });
              }}
              disabled={saving}
            />
          </label>
        </div>
      </section>

      <section className="detail__section">
        <h3>SOW</h3>
        {sowLink ? (
          <a href={sowLink} target="_blank" rel="noreferrer">
            Open document
          </a>
        ) : (
          <p className="detail__missing">Missing or not linked ({ev.sow || 'empty'})</p>
        )}
        <label>
          SOW URL
          <input
            type="url"
            defaultValue={ev.sow?.startsWith('http') ? ev.sow : ''}
            placeholder="https://drive.google.com/..."
            onBlur={(e) => {
              if (e.target.value !== ev.sow) saveField({ sow: e.target.value });
            }}
            disabled={saving}
          />
        </label>
      </section>

      <section className="detail__section">
        <h3>Notes</h3>
        <textarea
          defaultValue={ev.notes}
          rows={4}
          onBlur={(e) => {
            if (e.target.value !== ev.notes) saveField({ notes: e.target.value });
          }}
          disabled={saving}
        />
      </section>

      <section className="detail__section">
        <h3>Per diem allowances</h3>
        <p className="detail__section-hint">
          These amounts are used by the "Generate per diem forms" template task and pre-fill
          the form generator.
        </p>
        <div className="detail__grid detail__grid--3">
          <label>
            M&amp;IE daily rate (USD)
            <input
              type="number"
              min="0"
              step="0.01"
              key={ev.rowId + '-rate'}
              defaultValue={ev.perDiemRate ?? ''}
              placeholder="e.g. 35"
              onBlur={(e) => {
                if (e.target.value !== (ev.perDiemRate ?? '')) saveField({ perDiemRate: e.target.value });
              }}
              disabled={saving}
            />
          </label>
          <label>
            Max visa reimbursement (USD)
            <input
              type="number"
              min="0"
              step="0.01"
              key={ev.rowId + '-visa'}
              defaultValue={ev.maxVisaAllowance ?? ''}
              placeholder="e.g. 250"
              onBlur={(e) => {
                if (e.target.value !== (ev.maxVisaAllowance ?? '')) saveField({ maxVisaAllowance: e.target.value });
              }}
              disabled={saving}
            />
          </label>
          <label>
            Max ground transport (USD)
            <input
              type="number"
              min="0"
              step="0.01"
              key={ev.rowId + '-ground'}
              defaultValue={ev.maxGroundTransport ?? ''}
              placeholder="e.g. 60"
              onBlur={(e) => {
                if (e.target.value !== (ev.maxGroundTransport ?? '')) saveField({ maxGroundTransport: e.target.value });
              }}
              disabled={saving}
            />
          </label>
        </div>
        {(ev.perDiemRate || ev.maxVisaAllowance || ev.maxGroundTransport) && (
          <a
            className="detail__form-gen-link"
            href={`/per-diem-form?code=${encodeURIComponent(ev.code)}&event=${encodeURIComponent(ev.location || ev.code)}&location=${encodeURIComponent(ev.location || '')}&dates=${encodeURIComponent(ev.dates || '')}&rate=${encodeURIComponent(ev.perDiemRate || '')}&visa=${encodeURIComponent(ev.maxVisaAllowance || '')}&ground=${encodeURIComponent(ev.maxGroundTransport || '')}`}
            target="_blank"
            rel="noreferrer"
          >
            Open per diem form generator →
          </a>
        )}
      </section>

      <section className="detail__section">
        <h3>Assigned member</h3>
        {canAssign ? (
          <label>
            Project lead / owner
            <select
              value={ev.ownerEmail ?? ''}
              onChange={(e) => saveAssignee(e.target.value)}
              disabled={saving}
            >
              <option value="">— No assigned member —</option>
              {assignableMembers.map((m) => (
                <option key={m.id} value={m.email}>
                  {m.name} — {m.email}
                </option>
              ))}
              {ev.ownerEmail &&
                !assignableMembers.some(
                  (m) => m.email.toLowerCase() === ev.ownerEmail.toLowerCase(),
                ) && (
                  <option value={ev.ownerEmail}>{ev.ownerEmail} (not in team list)</option>
                )}
            </select>
          </label>
        ) : (
          <p className="detail__meta">
            {ev.ownerEmail ? ev.ownerEmail : 'No assigned member'}
          </p>
        )}
      </section>

      <section className="detail__section">
        <h3>Assigned team</h3>
        {canAssign ? (
          <>
            <ul className="detail__team-list">
              {assignableMembers.map((m) => {
                const checked = teamOrder.includes(m.email);
                const isLead = teamOrder[0] === m.email;
                return (
                  <li key={m.id} className="detail__team-row">
                    <label className="detail__team-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTeamMember(m.email)}
                        disabled={saving}
                      />
                      <PersonAvatar email={m.email} name={m.name} size={24} />
                      <span className="detail__team-name">{m.name}</span>
                    </label>
                    {checked && (
                      isLead ? (
                        <span className="detail__team-lead-tag">Lead</span>
                      ) : (
                        <button
                          type="button"
                          className="detail__team-lead-btn"
                          onClick={() => makeLead(m.email)}
                          disabled={saving}
                        >
                          Set as lead
                        </button>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="detail__team-save-btn"
              onClick={saveTeam}
              disabled={saving || !teamDirty}
            >
              {saving ? 'Saving…' : 'Save team'}
            </button>
          </>
        ) : (
          <p className="detail__meta">
            {teamOrder.length > 0
              ? teamOrder
                  .map((email, i) => {
                    const m = assignableMembers.find((x) => x.email.toLowerCase() === email.toLowerCase());
                    return (m?.name || email) + (i === 0 ? ' (lead)' : '');
                  })
                  .join(', ')
              : 'No team assigned'}
          </p>
        )}
      </section>
    </div>
  );
}
