/**
 * Event Calendar — a month grid of every event plus a per-person staffing
 * timeline, so schedule load and double-bookings are visible at a glance.
 * Route: /calendar
 */
import { useEffect, useMemo, useState } from 'react';
import { fetchEvents } from '../api/client';
import { getAssignableMembers } from '../utils/roleStore';
import { startOfMonth } from '../utils/calendarDates';
import type { Event } from '../types';
import { MonthView } from '../components/calendar/MonthView';
import { PeopleView } from '../components/calendar/PeopleView';
import { EventDetailCard } from '../components/calendar/EventDetailCard';
import { PeopleListCard } from '../components/calendar/PeopleListCard';
import './CalendarPage.css';

type View = 'month' | 'people';

export function CalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<View>('month');
  const [selectedEventRowId, setSelectedEventRowId] = useState<string | null>(null);
  const [selectedPersonEmail, setSelectedPersonEmail] = useState<string | null>(null);

  const members = useMemo(() => getAssignableMembers(), []);

  useEffect(() => {
    let cancelled = false;
    fetchEvents()
      .then((res) => {
        if (!cancelled) setEvents(res.events ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function prevMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1, 12, 0, 0, 0));
  }
  function nextMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1, 12, 0, 0, 0));
  }
  function goToday() {
    setMonth(startOfMonth(new Date()));
  }

  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const selectedEvent = selectedEventRowId
    ? events.find((e) => e.rowId === selectedEventRowId) ?? null
    : null;

  if (loading) {
    return <p className="cal__loading">Loading calendar…</p>;
  }

  return (
    <div className="cal">
      <div className="cal__toolbar">
        <div className="cal__title-block">
          <div className="cal__kicker">Schedule &amp; staffing</div>
          <h1 className="cal__title">Event Calendar</h1>
        </div>

        <div className="cal__controls">
          <div className="cal__stepper">
            <button type="button" className="cal__step-btn" onClick={prevMonth} aria-label="Previous month">‹</button>
            <span className="cal__month-label">{monthLabel}</span>
            <button type="button" className="cal__step-btn" onClick={nextMonth} aria-label="Next month">›</button>
          </div>
          <button type="button" className="cal__today-btn" onClick={goToday}>Today</button>
          <div className="cal__seg">
            <button
              type="button"
              className={`cal__seg-btn${view === 'month' ? ' cal__seg-btn--active' : ''}`}
              onClick={() => setView('month')}
            >
              Month
            </button>
            <button
              type="button"
              className={`cal__seg-btn${view === 'people' ? ' cal__seg-btn--active' : ''}`}
              onClick={() => setView('people')}
            >
              People
            </button>
          </div>
        </div>
      </div>

      <div className="cal__body">
        <div className="cal__main">
          {view === 'month' ? (
            <MonthView
              month={month}
              events={events}
              selectedEventRowId={selectedEventRowId}
              selectedPersonEmail={selectedPersonEmail}
              onSelectEvent={setSelectedEventRowId}
            />
          ) : (
            <PeopleView
              month={month}
              events={events}
              members={members}
              selectedEventRowId={selectedEventRowId}
              selectedPersonEmail={selectedPersonEmail}
              onSelectEvent={setSelectedEventRowId}
            />
          )}
        </div>

        <aside className="cal__aside">
          {selectedEvent && (
            <EventDetailCard
              event={selectedEvent}
              allEvents={events}
              onClose={() => setSelectedEventRowId(null)}
            />
          )}
          <PeopleListCard
            month={month}
            monthLabel={monthLabel}
            members={members}
            events={events}
            selectedPersonEmail={selectedPersonEmail}
            onSelectPerson={(email) => setSelectedPersonEmail(email || null)}
          />
        </aside>
      </div>
    </div>
  );
}
