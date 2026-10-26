import { useEffect, useRef, useState } from 'react';
import type { Event } from '../../types';
import { formatEventHeaderDates, getEventProgramDays } from '../../utils/calendarDates';
import { EVENT_STATUSES, type EventStatus } from '../../utils/eventLifecycle';
import { normalizeSupportLevel } from '../../utils/supportLevel';
import './EventHeader.css';

interface Props {
  event: Event;
  status: EventStatus;
  /** Only admins may change an event's status (the backend enforces it too). */
  canChangeStatus: boolean;
  savingStatus: boolean;
  onStatusChange: (status: EventStatus) => void;
  canEdit: boolean;
  onEdit: () => void;
  canAddTemplates: boolean;
  onAddTemplates: () => void;
  canDuplicate: boolean;
  onDuplicate: () => void;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}

/** Title, key facts and actions for one event: status, Edit event, and the ⋯ menu. */
export function EventHeader({
  event,
  status,
  canChangeStatus,
  savingStatus,
  onStatusChange,
  canEdit,
  onEdit,
  canAddTemplates,
  onAddTemplates,
  canDuplicate,
  onDuplicate,
  canDelete,
  deleting,
  onDelete,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const days = getEventProgramDays(event).length;
  const support = normalizeSupportLevel(event.supportLevel);
  const capacity = event.capacity?.trim();
  const hasMenu = canAddTemplates || canDuplicate || canDelete;

  const choose = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  return (
    <header className="ws-header">
      <div className="ws-header__main">
        <h1 className="ws-header__title">
          <span>{event.code}</span>
          {event.location && <span className="ws-header__place">{event.location}</span>}
        </h1>
        <div className="ws-header__meta">
          <span className="ws-header__dates">
            {formatEventHeaderDates(event)}
            {days > 1 ? ` · ${days} days` : ''}
          </span>
          {support && (
            <>
              <i className="ws-header__sep" />
              <span className={`ws-badge ws-badge--${support}`} title={support === 'full' ? 'Full Support LEM' : 'Minimum Support LEM'}>
                {support === 'full' ? 'Full' : 'Min'}
              </span>
            </>
          )}
          {capacity && (
            <>
              <i className="ws-header__sep" />
              <span className="ws-badge ws-badge--capacity">Capacity {capacity}</span>
            </>
          )}
          {event.driveFolderUrl && (
            <a className="ws-header__link" href={event.driveFolderUrl} target="_blank" rel="noopener noreferrer" title="Open the event folder in Google Drive">
              Drive folder ↗
            </a>
          )}
          {event.serviceReportDriveUrl && (
            <a className="ws-header__link" href={event.serviceReportDriveUrl} target="_blank" rel="noopener noreferrer" title="Open the saved Service Report">
              Service report ↗
            </a>
          )}
        </div>
      </div>

      <div className="ws-header__actions">
        {canChangeStatus ? (
          <span className="ws-status-select">
            <select
              className={`ws-status-select__control ws-status-select__control--${status.toLowerCase()}`}
              value={status}
              onChange={(e) => onStatusChange(e.target.value as EventStatus)}
              disabled={savingStatus}
              aria-label="Event status"
            >
              {EVENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {savingStatus && <span className="ws-status-select__saving">Saving…</span>}
          </span>
        ) : (
          <span className={`ws-status-pill ws-status-select__control--${status.toLowerCase()}`}>{status}</span>
        )}

        {canEdit && (
          <button type="button" className="ws-btn" onClick={onEdit}>
            Edit event
          </button>
        )}

        {hasMenu && (
          <div className="ws-menu" ref={menuRef}>
            <button
              type="button"
              className="ws-btn ws-btn--round"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              ⋯
            </button>
            {menuOpen && (
              <div className="ws-menu__panel" role="menu">
                {canAddTemplates && (
                  <button type="button" role="menuitem" onClick={choose(onAddTemplates)}>
                    Add tasks from template
                  </button>
                )}
                {canDuplicate && (
                  <button type="button" role="menuitem" onClick={choose(onDuplicate)}>
                    Duplicate event
                  </button>
                )}
                {canDelete && (canAddTemplates || canDuplicate) && <div className="ws-menu__divider" />}
                {canDelete && (
                  <button type="button" role="menuitem" className="ws-menu__danger" disabled={deleting} onClick={choose(onDelete)}>
                    {deleting ? 'Deleting…' : 'Delete event'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
