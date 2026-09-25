import type { Event } from '../../types';
import type { OrgMember } from '../../utils/roleStore';
import { buildMonthDays, getEventDateRange } from '../../utils/calendarDates';
import { isPersonOnEvent } from '../../utils/teamAssignment';
import { PersonAvatar } from './PersonAvatar';
import './PeopleListCard.css';

interface Props {
  month: Date;
  monthLabel: string;
  members: OrgMember[];
  events: Event[];
  selectedPersonEmail: string | null;
  onSelectPerson: (email: string) => void;
}

function daysAssigned(person: OrgMember, events: Event[], month: Date): number {
  const days = buildMonthDays(month);
  let count = 0;
  for (const day of days) {
    const onSomething = events.some((ev) => {
      if (!isPersonOnEvent(ev, person.email)) return false;
      const range = getEventDateRange(ev);
      return !!range && range.start <= day.iso && day.iso <= range.end;
    });
    if (onSomething) count++;
  }
  return count;
}

export function PeopleListCard({ month, monthLabel, members, events, selectedPersonEmail, onSelectPerson }: Props) {
  return (
    <div className="plc">
      <div className="plc__header">
        <div className="plc__title">People</div>
        {selectedPersonEmail && (
          <button type="button" className="plc__clear" onClick={() => onSelectPerson('')}>
            Show everyone
          </button>
        )}
      </div>

      {members.map((m) => {
        const selected = selectedPersonEmail?.toLowerCase() === m.email.toLowerCase();
        const faded = !!selectedPersonEmail && !selected;
        return (
          <button
            key={m.id}
            type="button"
            className={`plc__row${selected ? ' plc__row--selected' : ''}`}
            style={{ opacity: faded ? 0.5 : 1 }}
            onClick={() => onSelectPerson(selected ? '' : m.email)}
          >
            <PersonAvatar email={m.email} name={m.name} size={30} />
            <div className="plc__row-text">
              <div className="plc__row-name">{m.name}</div>
              <div className="plc__row-role">{m.role}</div>
            </div>
            <div className="plc__row-count">
              <div className="plc__row-num">{daysAssigned(m, events, month)}</div>
              <div className="plc__row-label">days</div>
            </div>
          </button>
        );
      })}

      <p className="plc__footnote">
        Event days assigned in {monthLabel}. Pick a person to highlight their schedule.
      </p>
    </div>
  );
}
