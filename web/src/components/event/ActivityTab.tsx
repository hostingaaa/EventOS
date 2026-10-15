import type { ActivityItem } from '../../types';
import { activityPhrase, actorName, formatLogTime } from '../../utils/activityText';

export function ActivityTab({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <section className="ws-panel ws-activity">
        <p className="ws-panel__empty">No activity yet.</p>
      </section>
    );
  }
  return (
    <section className="ws-panel ws-activity">
      {items.map((a) => (
        <div key={a.activityId} className="ws-activity__row">
          <time className="ws-activity__time" title={new Date(a.createdAt).toLocaleString('en-GB')}>
            {formatLogTime(a.createdAt)}
          </time>
          <span>
            <strong>{actorName(a.actor)}</strong> {activityPhrase(a)}
          </span>
        </div>
      ))}
    </section>
  );
}
