import type { Event } from '../../types';
import type { OrgMember } from '../../utils/roleStore';
import {
  assignEventLanes,
  buildMonthDays,
  eventBarSpan,
  getEventDateRange,
} from '../../utils/calendarDates';
import { getEventLead, isPersonOnEvent } from '../../utils/teamAssignment';
import { getPersonColor } from '../../utils/personColors';
import { PersonAvatar } from './PersonAvatar';
import './PeopleView.css';

const LANE_H = 34;

interface Props {
  month: Date;
  events: Event[];
  members: OrgMember[];
  selectedEventRowId: string | null;
  selectedPersonEmail: string | null;
  onSelectEvent: (rowId: string) => void;
}

export function PeopleView({ month, events, members, selectedEventRowId, selectedPersonEmail, onSelectEvent }: Props) {
  const days = buildMonthDays(month);
  const gridCols = `180px repeat(${days.length}, minmax(26px, 1fr))`;

  return (
    <div className="pv">
      <div className="pv__scroll">
        <div className="pv__head" style={{ gridTemplateColumns: gridCols }}>
          <div />
          {days.map((d) => (
            <div key={d.iso} className={`pv__head-day${d.isToday ? ' pv__head-day--today' : d.isWeekend ? ' pv__head-day--weekend' : ''}`}>
              {d.dayNum}
            </div>
          ))}
        </div>

        {members.map((person) => {
          const mine = events
            .filter((ev) => isPersonOnEvent(ev, person.email))
            .map((ev) => {
              const range = getEventDateRange(ev);
              return range ? { ev, start: range.start, end: range.end } : null;
            })
            .filter((x): x is { ev: Event; start: string; end: string } => !!x)
            .filter((x) => eventBarSpan(x.start, x.end, days));

          const lanes = assignEventLanes(mine.map((x) => ({ id: x.ev.rowId, start: x.start, end: x.end })));
          const maxLane = mine.length ? Math.max(...mine.map((x) => lanes.get(x.ev.rowId) ?? 0)) : 0;
          const laneCount = maxLane + 1;
          const faded = !!selectedPersonEmail && selectedPersonEmail.toLowerCase() !== person.email.toLowerCase();

          return (
            <div
              key={person.id}
              className="pv__row"
              style={{
                gridTemplateColumns: gridCols,
                gridTemplateRows: `repeat(${laneCount}, ${LANE_H}px)`,
                opacity: faded ? 0.3 : 1,
              }}
            >
              <div className="pv__label" style={{ gridRow: `1 / span ${laneCount}` }}>
                <PersonAvatar email={person.email} name={person.name} size={28} />
                <div className="pv__label-text">
                  <div className="pv__label-name">{person.name}</div>
                  <div className="pv__label-role">{person.role}</div>
                </div>
              </div>

              {days.map((d, i) => (
                <div
                  key={d.iso}
                  className={`pv__daybg${d.isToday ? ' pv__daybg--today' : d.isWeekend ? ' pv__daybg--weekend' : ''}`}
                  style={{ gridRow: `1 / span ${laneCount}`, gridColumn: i + 2 }}
                />
              ))}

              {mine.map(({ ev, start, end }) => {
                const span = eventBarSpan(start, end, days);
                if (!span) return null;
                const lead = getEventLead(ev);
                const isLead = lead?.toLowerCase() === person.email.toLowerCase();
                const color = lead ? getPersonColor(lead) : getPersonColor(person.email);
                const lane = lanes.get(ev.rowId) ?? 0;
                const selected = ev.rowId === selectedEventRowId;
                return (
                  <button
                    key={ev.rowId}
                    type="button"
                    className={`pv__bar${selected ? ' pv__bar--selected' : ''}`}
                    style={{
                      gridColumn: `${span.startCol} / span ${span.span}`,
                      gridRow: lane + 1,
                      background: isLead ? color.solid : color.tintBg,
                      color: isLead ? '#fff' : color.tintText,
                      borderColor: color.solid,
                    }}
                    title={`${ev.code} · ${ev.location}`}
                    onClick={() => onSelectEvent(ev.rowId)}
                  >
                    <span className="pv__bar-code">{ev.code}</span>
                    <span className="pv__bar-label">{ev.location}{isLead ? ' · lead' : ''}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
