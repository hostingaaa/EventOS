import type { Event } from '../../types';
import { buildMonthGrid, getEventDateRange } from '../../utils/calendarDates';
import { getEventLead, isPersonOnEvent, parseAssignedTeam } from '../../utils/teamAssignment';
import { getPersonColor } from '../../utils/personColors';
import { PersonAvatar } from './PersonAvatar';
import './MonthView.css';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_CHIPS_PER_DAY = 3;

interface Props {
  month: Date;
  events: Event[];
  selectedEventRowId: string | null;
  selectedPersonEmail: string | null;
  onSelectEvent: (rowId: string) => void;
}

export function MonthView({ month, events, selectedEventRowId, selectedPersonEmail, onSelectEvent }: Props) {
  const days = buildMonthGrid(month, 'monday');

  const withRanges = events
    .map((ev) => ({ ev, range: getEventDateRange(ev) }))
    .filter((x): x is { ev: Event; range: NonNullable<ReturnType<typeof getEventDateRange>> } => !!x.range);

  return (
    <div className="mv">
      <div className="mv__weekdays">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="mv__weekday">{w}</div>
        ))}
      </div>
      <div className="mv__grid">
        {days.map((day) => {
          const dayEvents = withRanges.filter((x) => x.range.start <= day.iso && day.iso <= x.range.end);
          const visible = dayEvents.slice(0, MAX_CHIPS_PER_DAY);
          const overflow = dayEvents.length - visible.length;

          return (
            <div
              key={day.iso}
              className={`mv__cell${day.isOutsideMonth ? ' mv__cell--outside' : day.isWeekend ? ' mv__cell--weekend' : ''}${day.isToday ? ' mv__cell--today' : ''}`}
            >
              <div className="mv__cell-head">
                <span className={`mv__daynum${day.isToday ? ' mv__daynum--today' : ''}`}>{day.dayNum}</span>
                {day.isToday && <span className="mv__today-label">Today</span>}
              </div>

              <div className="mv__chips">
                {visible.map(({ ev, range }) => {
                  const continued = range.start !== day.iso;
                  const lead = getEventLead(ev);
                  const color = lead ? getPersonColor(lead) : getPersonColor(ev.code);
                  const team = parseAssignedTeam(ev);
                  const dimmed = !!selectedPersonEmail && !isPersonOnEvent(ev, selectedPersonEmail);
                  const selected = ev.rowId === selectedEventRowId;

                  return (
                    <button
                      key={ev.rowId}
                      type="button"
                      className={`mv__chip${continued ? ' mv__chip--continued' : ''}${selected ? ' mv__chip--selected' : ''}`}
                      style={{
                        background: color.tintBg,
                        color: color.tintText,
                        opacity: dimmed ? 0.25 : 1,
                      }}
                      title={`${ev.code} · ${ev.location}${team.length ? ' · ' + team.join(', ') : ''}`}
                      onClick={() => onSelectEvent(ev.rowId)}
                    >
                      <span className="mv__chip-code">{ev.code}</span>
                      <span className="mv__chip-city" style={{ opacity: continued ? 0.55 : 0.8 }}>
                        {continued ? 'cont.' : ev.location}
                      </span>
                      {!continued && team.length > 0 && (
                        <span className="mv__chip-avatars">
                          {team.map((email, i) => (
                            <PersonAvatar
                              key={email}
                              email={email}
                              size={18}
                              style={{
                                marginLeft: i ? -5 : 0,
                                boxShadow: `0 0 0 1.5px ${color.tintBg}`,
                              }}
                            />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
                {overflow > 0 && <span className="mv__chip-overflow">+{overflow} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
