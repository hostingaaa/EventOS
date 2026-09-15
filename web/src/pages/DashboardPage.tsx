import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteEvent, fetchDashboardHealth, fetchEvents } from '../api/client';
import { useUser } from '../context/UserContext';
import type { Event, EventHealth } from '../types';
import { NewProjectModal } from '../components/NewProjectModal';
import { getEventDateRange, parseIsoDate, todayAtNoon } from '../utils/calendarDates';
import './DashboardPage.css';

type Filter = 'all' | 'attention' | 'missing-sow' | 'missing-venue' | 'critical';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All active' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'critical', label: 'Behind schedule' },
  { id: 'missing-sow', label: 'Missing SOW' },
  { id: 'missing-venue', label: 'Missing venue' },
];

/** Circular-arrow refresh icon. Uses currentColor so it picks up the
 * button's own color (green, via .dashboard__refresh). */
function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  );
}

/** Calendar-with-a-plus "new event" icon. Uses currentColor so it picks up
 * the button's own color (white, on .dashboard__new's green fill). */
function NewEventIcon() {
  return (
    <svg
      width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="7" y1="2" x2="7" y2="6" />
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="17" y1="2" x2="17" y2="6" />
      <rect x="4" y="4.5" width="16" height="16.5" rx="2" />
      <line x1="4" y1="9.5" x2="20" y2="9.5" />
      <line x1="12" y1="12.5" x2="12" y2="18" />
      <line x1="9.25" y1="15.25" x2="14.75" y2="15.25" />
    </svg>
  );
}

/** Magnifying-glass search icon for the toolbar's search field. */
function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <line x1="21" y1="21" x2="16.2" y2="16.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

const COMPLETED_THRESHOLD = 15; // days past endDate → completed
const IMMINENT_DAYS = 7;        // days until startDate → countdown pill

// Anchored at local noon (not midnight) so date-only "yyyy-MM-dd" fields
// compare correctly regardless of the viewer's UTC offset — `new Date(s)`
// parses a bare date as UTC midnight, which drifts into the previous local
// day for any positive-offset timezone and silently breaks same-day checks
// like isHappening(). Matches the convention in utils/calendarDates.ts.
function today(): Date {
  return todayAtNoon();
}

function parseDate(s: string | undefined): Date | null {
  return parseIsoDate(s);
}

/** Dashboard-only label, e.g. "Sep 15-17, 2026". */
function formatDashboardDates(ev: Event): string {
  const range = getEventDateRange(ev);
  if (!range) return ev.dates?.trim() || '—';

  const start = parseDate(range.start);
  const end = parseDate(range.end);
  if (!start) return ev.dates?.trim() || '—';

  const monthShort = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short' });

  if (!end || start.toDateString() === end.toDateString()) {
    return `${monthShort(start)} ${start.getDate()}, ${start.getFullYear()}`;
  }

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${monthShort(start)} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${monthShort(start)} ${start.getDate()} – ${monthShort(end)} ${end.getDate()}, ${start.getFullYear()}`;
  }

  return `${monthShort(start)} ${start.getDate()}, ${start.getFullYear()} – ${monthShort(end)} ${end.getDate()}, ${end.getFullYear()}`;
}

/** Split "City, Country" into its two parts for the stacked Location cell. */
function splitLocation(location: string): { city: string; country: string } {
  const trimmed = (location || '').trim();
  if (!trimmed) return { city: '—', country: '' };
  const idx = trimmed.indexOf(',');
  if (idx === -1) return { city: trimmed, country: '' };
  return { city: trimmed.slice(0, idx).trim(), country: trimmed.slice(idx + 1).trim() };
}

function isCompleted(ev: Event, archivedCodes: Set<string>): boolean {
  if (archivedCodes.has(ev.code)) return true;
  const end = parseDate(ev.endDate);
  if (!end) return false;
  return Math.floor((today().getTime() - end.getTime()) / 86_400_000) > COMPLETED_THRESHOLD;
}

function daysUntilStart(ev: Event): number | null {
  const s = parseDate(ev.startDate);
  if (!s) return null;
  return Math.floor((s.getTime() - today().getTime()) / 86_400_000);
}

function isHappening(ev: Event): boolean {
  const s = parseDate(ev.startDate);
  const e = parseDate(ev.endDate);
  const t = today();
  if (!s) return false;
  if (s > t) return false;
  if (e && e < t) return false;
  return true;
}

/** SOW secured — reused as the "Awarded" badge on each row. */
function isAwarded(ev: Event): boolean {
  const sow = ev.sow?.trim().toLowerCase();
  return Boolean(sow) && sow !== '??';
}

/** Derive "Month YYYY" label from a startDate ISO string. */
function monthLabel(startDate: string | undefined, fallback: string): string {
  const d = parseDate(startDate ?? '');
  if (!d) return fallback || 'Unscheduled';
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/**
 * Group events by month and sort:
 *  - months chronologically (earliest first for active, latest first for completed)
 *  - events within each month by startDate ascending
 */
function groupByMonth(
  events: Event[],
  monthOrder: 'asc' | 'desc' = 'asc',
): Array<{ month: string; events: Event[] }> {
  const map = new Map<string, { events: Event[]; anchor: Date }>();

  const list = Array.isArray(events) ? events : [];
  for (const ev of list) {
    const label = monthLabel(ev.startDate, ev.monthGroup);
    const anchor = parseDate(ev.startDate) ?? new Date(0);
    if (!map.has(label)) map.set(label, { events: [], anchor });
    map.get(label)!.events.push(ev);
  }

  // Sort events within each month by startDate ascending
  for (const bucket of map.values()) {
    bucket.events.sort((a, b) => {
      const da = parseDate(a.startDate);
      const db = parseDate(b.startDate);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    });
    // Update anchor to first event's date for reliable month ordering
    const first = parseDate(bucket.events[0]?.startDate);
    if (first) bucket.anchor = first;
  }

  // Sort months
  const entries = Array.from(map.entries()).sort(([, a], [, b]) => {
    const diff = a.anchor.getTime() - b.anchor.getTime();
    return monthOrder === 'asc' ? diff : -diff;
  });

  return entries.map(([month, { events: evs }]) => ({ month, events: evs }));
}

function matchesFilter(ev: Event, filter: Filter, health?: EventHealth | null): boolean {
  if (filter === 'all') return true;
  const sow = ev.sow?.trim().toLowerCase();
  const missingSow = !sow || sow === '??';
  const missingVenue = !ev.venue?.trim();
  const lemOpen = ev.lem?.trim().toLowerCase() !== 'closed';
  if (filter === 'attention') return missingSow || missingVenue || lemOpen;
  if (filter === 'missing-sow') return missingSow;
  if (filter === 'missing-venue') return missingVenue;
  if (filter === 'critical') return health?.tier === 'critical' || health?.tier === 'at-risk';
  return true;
}

function matchesSearch(ev: Event, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    ev.code.toLowerCase().includes(needle) ||
    ev.location.toLowerCase().includes(needle) ||
    ev.ownerEmail.toLowerCase().includes(needle)
  );
}

/** Status pill text + tone — "Live" overrides the health tier while an event is underway. */
function statusInfo(tier: EventHealth['tier'] | null, happening: boolean): { label: string; tone: string } {
  if (happening) return { label: 'Live', tone: 'live' };
  if (tier === 'on-track') return { label: 'On track', tone: 'on-track' };
  if (tier === 'attention') return { label: 'Needs work', tone: 'attention' };
  if (tier === 'at-risk' || tier === 'critical') return { label: 'Behind', tone: 'behind' };
  return { label: '—', tone: 'none' };
}

// ─── EventRow ─────────────────────────────────────────────────────────────────

interface RowProps {
  ev: Event;
  health?: EventHealth | null;
  isCompleted: boolean;
  isAdmin: boolean;
  canDelete: boolean;
  deleting: boolean;
  onArchive: (code: string) => void;
  onUnarchive: (code: string) => void;
  onDelete: (ev: Event) => void;
}

function EventRow({
  ev,
  health,
  isCompleted: done,
  isAdmin,
  canDelete,
  deleting,
  onArchive,
  onUnarchive,
  onDelete,
}: RowProps) {
  const tier = health?.tier ?? null;
  const days = daysUntilStart(ev);
  const happening = isHappening(ev);
  const showCountdown = !done && days !== null && days >= 0 && days <= IMMINENT_DAYS;
  const { city, country } = splitLocation(ev.location);
  const awarded = isAwarded(ev);
  const { label: statusLabel, tone } = statusInfo(tier, happening);
  const filledDots = health ? Math.min(5, Math.max(0, Math.round(health.completion / 20))) : 0;

  return (
    <div className={`dashboard__row-wrap${done ? ' dashboard__row-wrap--completed' : ''}`}>
      <Link
        to={`/event/${encodeURIComponent(ev.code)}`}
        className={`dashboard__row dashboard__row--${tier ?? 'none'}`}
      >
        <span className="dashboard__row-bar" aria-hidden="true" />

        {/* Event code */}
        <span className="dl-event">
          <span className="dl-code">
            {ev.code}
            {!ev.venue && <span className="dl-flag" title="No venue confirmed">!</span>}
          </span>
          {awarded && <span className="dl-awarded">Awarded</span>}
        </span>

        {/* Location */}
        <span className="dl-location">
          <span className="dl-location__city">{city}</span>
          {country && <span className="dl-location__country">{country}</span>}
        </span>

        {/* Dates */}
        <span className="dl-dates">{formatDashboardDates(ev)}</span>

        {/* Assigned */}
        <span className="dl-assigned">
          {showCountdown && (
            <span className="dl-countdown">{days === 0 ? 'Today' : `In ${days}d`}</span>
          )}
          {ev.ownerEmail ? (
            <span className="dl-owner__chip">
              <span className="dl-owner__avatar">{ev.ownerEmail.charAt(0).toUpperCase()}</span>
              <span className="dl-owner__name">{ev.ownerEmail.split('@')[0]}</span>
            </span>
          ) : (
            <span className="dl-owner__none">—</span>
          )}
        </span>

        {/* Status */}
        <span className={`dl-status dl-status--${tone}`}>
          <span className="dl-status__dots" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`dl-dot${i < filledDots ? ' dl-dot--on' : ''}`} />
            ))}
          </span>
          <span className="dl-status__label">{statusLabel}</span>
        </span>

        <span className="dl-arrow" aria-hidden="true">→</span>
      </Link>

      {(isAdmin || canDelete) && (
        <div className="dl-admin-actions">
          {isAdmin && (
            <button
              type="button"
              className={`dl-archive-btn${done ? ' dl-archive-btn--restore' : ''}`}
              title={done ? 'Restore to active' : 'Archive event'}
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                if (done) onUnarchive(ev.code); else onArchive(ev.code);
              }}
            >
              {done ? '↩' : '⊙'}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="dl-delete-btn"
              title="Delete event permanently"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                onDelete(ev);
              }}
            >
              {deleting ? '…' : '✕'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Month section ────────────────────────────────────────────────────────────

interface MonthSectionProps {
  month: string;
  events: Event[];
  healthByCode: Record<string, EventHealth>;
  isCompleted: boolean;
  isAdmin: boolean;
  canDelete: boolean;
  deletingId: string | null;
  onArchive: (code: string) => void;
  onUnarchive: (code: string) => void;
  onDelete: (ev: Event) => void;
}

function MonthSection({
  month,
  events,
  healthByCode,
  isCompleted,
  isAdmin,
  canDelete,
  deletingId,
  onArchive,
  onUnarchive,
  onDelete,
}: MonthSectionProps) {
  return (
    <div className="dashboard__month-group">
      <h2 className="dashboard__month-heading">
        <span className="dmh-label">{month}</span>
        <span className="dmh-rule" aria-hidden="true" />
        <span className="dmh-count">{events.length}</span>
      </h2>
      <div className="dashboard__list">
        <div className="dashboard__list-head">
          <span className="dlh-event">Event</span>
          <span className="dlh-location">Location</span>
          <span className="dlh-dates">Dates</span>
          <span className="dlh-assigned">Assigned</span>
          <span className="dlh-status">Status</span>
        </div>
        {events.map((ev) => (
          <EventRow
            key={ev.rowId}
            ev={ev}
            health={healthByCode[ev.code]}
            isCompleted={isCompleted}
            isAdmin={isAdmin}
            canDelete={canDelete}
            deleting={deletingId === ev.rowId}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user, isAdmin, can } = useUser();
  const navigate = useNavigate();

  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [healthByCode, setHealthByCode] = useState<Record<string, EventHealth>>({});
  const [completedOpen, setCompletedOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [archivedCodes, setArchivedCodes] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('archived_events');
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, health] = await Promise.all([fetchEvents(), fetchDashboardHealth()]);
      setEvents(data.events ?? []);
      setHealthByCode(health);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function archive(code: string) {
    setArchivedCodes((prev) => {
      const next = new Set([...prev, code]);
      localStorage.setItem('archived_events', JSON.stringify([...next]));
      return next;
    });
  }

  function unarchive(code: string) {
    setArchivedCodes((prev) => {
      const next = new Set([...prev].filter((c) => c !== code));
      localStorage.setItem('archived_events', JSON.stringify([...next]));
      return next;
    });
  }

  async function handleDelete(ev: Event) {
    if (!user?.email || !can('events.delete')) return;
    const label = ev.code + (ev.location ? ` — ${ev.location}` : '');
    if (
      !confirm(
        `Delete "${label}" permanently?\n\nThis removes the event and its tasks from the dashboard. This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(ev.rowId);
    try {
      await deleteEvent(ev.rowId, ev.code, user.email);
      setEvents((prev) => prev.filter((e) => e.rowId !== ev.rowId));
      setHealthByCode((prev) => {
        const next = { ...prev };
        delete next[ev.code];
        return next;
      });
      unarchive(ev.code);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete event');
    } finally {
      setDeletingId(null);
    }
  }

  const canDelete = can('events.delete');

  // Split events into active / completed
  const { activeEvents, completedEvents } = useMemo(() => {
    const active: Event[] = [];
    const completed: Event[] = [];
    const list = Array.isArray(events) ? events : [];
    for (const ev of list) {
      (isCompleted(ev, archivedCodes) ? completed : active).push(ev);
    }
    return { activeEvents: active, completedEvents: completed };
  }, [events, archivedCodes]);

  // Distinct owners among active events, for the "All owners" filter
  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const ev of activeEvents) {
      const email = ev.ownerEmail?.trim();
      if (email) set.add(email);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [activeEvents]);

  // Per-filter counts, independent of which tab is currently selected
  const filterCounts = useMemo(() => {
    const counts = {} as Record<Filter, number>;
    for (const { id } of FILTERS) {
      counts[id] = activeEvents.filter((e) => matchesFilter(e, id, healthByCode[e.code])).length;
    }
    return counts;
  }, [activeEvents, healthByCode]);

  // Apply tab filter + search + owner filter to active events
  const filteredActive = useMemo(
    () =>
      activeEvents.filter(
        (e) =>
          matchesFilter(e, filter, healthByCode[e.code]) &&
          matchesSearch(e, search) &&
          (!ownerFilter || e.ownerEmail === ownerFilter),
      ),
    [activeEvents, filter, healthByCode, search, ownerFilter],
  );

  // Group & sort
  const activeGroups = useMemo(() => groupByMonth(filteredActive, 'asc'), [filteredActive]);
  const completedGroups = useMemo(() => groupByMonth(completedEvents, 'desc'), [completedEvents]);

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard__header">
        <div className="dashboard__header-top">
          <div className="dashboard__header-title">
            <h1>Event Operations</h1>
            <div className="dashboard__header-actions">
              <button
                type="button"
                className={`dashboard__refresh${loading ? ' loading' : ''}`}
                onClick={load}
                disabled={loading}
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshIcon />
              </button>
              {user && (
                <button
                  type="button"
                  className="dashboard__new dashboard__new--icon"
                  onClick={() => setShowNewProject(true)}
                  title="New event"
                  aria-label="New event"
                >
                  <NewEventIcon />
                </button>
              )}
            </div>
          </div>

          <div className="dashboard__stats">
            <div className="dashboard__stat">
              <strong>{activeEvents.length}</strong>
              <small>Active</small>
            </div>
            <div className="dashboard__stat dashboard__stat--accent">
              <strong>{filterCounts.attention}</strong>
              <small>Need action</small>
            </div>
            <div className="dashboard__stat">
              <strong>{completedEvents.length}</strong>
              <small>Completed</small>
            </div>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="dashboard__toolbar">
        <div className="dashboard__filters">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`dashboard__filter-pill${filter === id ? ' active' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
              <span className="dashboard__filter-count">{filterCounts[id]}</span>
            </button>
          ))}
        </div>

        <div className="dashboard__toolbar-controls">
          <label className="dashboard__search">
            <SearchIcon />
            <input
              type="search"
              placeholder="Search event, city or owner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            className="dashboard__owner-filter"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="">All owners</option>
            {owners.map((email) => (
              <option key={email} value={email}>{email.split('@')[0]}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="dashboard__msg">Loading events…</p>}
      {error && <p className="dashboard__msg dashboard__msg--err">{error}</p>}

      {!loading && !error && (Array.isArray(events) ? events : []).length === 0 && (
        <div className="dashboard__empty">
          <p>No events yet.</p>
          {user && (
            <button type="button" className="dashboard__new" onClick={() => setShowNewProject(true)}>
              + Create first event
            </button>
          )}
        </div>
      )}

      {/* Active events — month sections */}
      {activeGroups.map(({ month, events: monthEvents }) => (
        <MonthSection
          key={month}
          month={month}
          events={monthEvents}
          healthByCode={healthByCode}
          isCompleted={false}
          isAdmin={isAdmin}
          canDelete={canDelete}
          deletingId={deletingId}
          onArchive={archive}
          onUnarchive={unarchive}
          onDelete={handleDelete}
        />
      ))}

      {!loading && filteredActive.length === 0 && activeEvents.length > 0 && (
        <p className="dashboard__msg">No active events match the current filter.</p>
      )}

      {/* Completed events — collapsible, grouped by month */}
      {completedGroups.length > 0 && (
        <div className="dashboard__completed">
          <button
            type="button"
            className="dashboard__completed-toggle"
            onClick={() => setCompletedOpen((o) => !o)}
            aria-expanded={completedOpen}
          >
            <span className={`dc-chevron${completedOpen ? ' dc-chevron--open' : ''}`} aria-hidden="true">›</span>
            Completed events
            <span className="dc-count">{completedEvents.length}</span>
            <span className="dc-hint">{completedOpen ? 'Collapse' : 'Expand'}</span>
          </button>

          {completedOpen && (
            <div className="dashboard__completed-body">
              {completedGroups.map(({ month, events: monthEvents }) => (
                <MonthSection
                  key={month}
                  month={month}
                  events={monthEvents}
                  healthByCode={healthByCode}
                  isCompleted
                  isAdmin={isAdmin}
                  canDelete={canDelete}
                  deletingId={deletingId}
                  onArchive={archive}
                  onUnarchive={unarchive}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showNewProject && user && (
        <NewProjectModal
          actorEmail={user.email}
          onClose={() => setShowNewProject(false)}
          onCreated={(code) => {
            setShowNewProject(false);
            navigate(`/event/${encodeURIComponent(code)}`);
          }}
        />
      )}
    </div>
  );
}
