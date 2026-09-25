import { Link } from 'react-router-dom';
import type { Event } from '../../types';
import { getEventStatus } from '../../utils/eventLifecycle';
import { formatEventHeaderDates } from '../../utils/calendarDates';
import { getMemberByEmail } from '../../utils/roleStore';
import { isDoubleBooked, parseAssignedTeam } from '../../utils/teamAssignment';
import { PersonAvatar } from './PersonAvatar';
import './EventDetailCard.css';

interface Props {
  event: Event;
  allEvents: Event[];
  onClose: () => void;
}

export function EventDetailCard({ event, allEvents, onClose }: Props) {
  const team = parseAssignedTeam(event);
  const awarded = getEventStatus(event) === 'Awarded';

  return (
    <div className="edc">
      <div className="edc__top">
        <div className="edc__main">
          <div className="edc__title">
            <span className="edc__code">{event.code}</span>
            {awarded && <span className="edc__awarded">Awarded</span>}
          </div>
          <div className="edc__location">{event.location}</div>
          <div className="edc__dates">{formatEventHeaderDates(event)}</div>
        </div>
        <button type="button" className="edc__close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="edc__section-title">Assigned team</div>
      {team.length === 0 && <p className="edc__empty">No team assigned yet.</p>}
      {team.map((email, i) => {
        const member = getMemberByEmail(email);
        const doubleBooked = isDoubleBooked(email, event.rowId, event, allEvents);
        return (
          <div key={email} className="edc__team-row">
            <PersonAvatar email={email} name={member?.name} size={28} />
            <div className="edc__team-info">
              <div className="edc__team-name">{member?.name ?? email}</div>
              <div className="edc__team-role">
                {i === 0 ? 'Lead' : 'Support'}{member?.role ? ` · ${member.role}` : ''}
              </div>
            </div>
            <span className={`edc__team-status${doubleBooked ? ' edc__team-status--conflict' : ''}`}>
              {doubleBooked ? 'Double-booked' : 'Available'}
            </span>
          </div>
        );
      })}

      <Link to={`/event/${encodeURIComponent(event.code)}`} className="edc__link">
        Open in Events →
      </Link>
    </div>
  );
}
