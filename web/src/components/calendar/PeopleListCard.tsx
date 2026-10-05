import type { Event } from '../../types';
import type { OrgMember } from '../../utils/roleStore';
import { isEventActive } from '../../utils/eventLifecycle';
import { isPersonOnEvent } from '../../utils/teamAssignment';
import { PersonAvatar } from './PersonAvatar';
import './PeopleListCard.css';

interface Props {
  members: OrgMember[];
  events: Event[];
  selectedPersonEmail: string | null;
  onSelectPerson: (email: string) => void;
}

/** Programs this person is on that are still active (Proposed or Awarded),
 * across all months — the same definition as the dashboard's "Active events". */
function activePrograms(person: OrgMember, events: Event[]): number {
  return events.filter((ev) => isEventActive(ev) && isPersonOnEvent(ev, person.email)).length;
}

export function PeopleListCard({ members, events, selectedPersonEmail, onSelectPerson }: Props) {
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
              <div className="plc__row-num">{activePrograms(m, events)}</div>
              <div className="plc__row-label">{activePrograms(m, events) === 1 ? 'program' : 'programs'}</div>
            </div>
          </button>
        );
      })}

      <p className="plc__footnote">
        Active programs assigned to each person. Pick a person to highlight their schedule.
      </p>
    </div>
  );
}
