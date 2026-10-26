import type { Comment, Event } from '../../types';
import { EventDetail } from '../EventDetail';
import { NotesPanel } from './NotesPanel';
import { formatEventHeaderDates, getEventProgramDays } from '../../utils/calendarDates';
import { getMemberByEmail } from '../../utils/roleStore';
import { getEventStatus } from '../../utils/eventLifecycle';
import { normalizeSupportLevel } from '../../utils/supportLevel';
import { getEventLead } from '../../utils/teamAssignment';

interface Props {
  event: Event;
  eventComments: Comment[];
  onEventUpdated: (event: Event) => void;
  onCommentAdded: (comment: Comment) => void;
}

const SUPPORT_LABEL = { full: 'Full Support LEM', minimal: 'Minimum Support LEM', '': '' } as const;

export function DetailsTab({ event, eventComments, onEventUpdated, onCommentAdded }: Props) {
  const days = getEventProgramDays(event).length;
  const leadEmail = getEventLead(event) ?? '';
  const lead = leadEmail ? (getMemberByEmail(leadEmail)?.name ?? leadEmail) : '';

  const rows: [string, string][] = [
    ['Event code', event.code],
    ['Location', event.location || '—'],
    ['Dates', `${formatEventHeaderDates(event)}${days > 1 ? ` · ${days} days` : ''}`],
    ['Status', getEventStatus(event)],
    ['Support level', SUPPORT_LABEL[normalizeSupportLevel(event.supportLevel)] || '—'],
    ['Capacity', event.capacity?.trim() || '—'],
    ['Event lead', lead || '—'],
  ];

  return (
    <div className="ws-details">
      <div className="ws-kv">
        {rows.map(([k, v]) => (
          <div key={k} className="ws-kv__row">
            <span className="ws-kv__key">{k}</span>
            <span className="ws-kv__value">{v}</span>
          </div>
        ))}
      </div>

      <EventDetail event={event} onUpdated={onEventUpdated} />

      <div className="ws-card ws-discussion">
        <NotesPanel
          heading="Event-wide discussion"
          comments={eventComments}
          eventCode={event.code}
          onAdded={onCommentAdded}
          audience="Not tied to a task"
          emptyText="No messages yet — start the conversation."
        />
      </div>
    </div>
  );
}
