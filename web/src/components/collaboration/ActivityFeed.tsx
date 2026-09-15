import type { ActivityItem } from '../../types';
import './ActivityFeed.css';

interface Props {
  items: ActivityItem[];
}

const TYPE_LABEL: Record<string, string> = {
  task_created: 'Task created',
  task_updated: 'Task updated',
  comment_added: 'Comment',
  file_uploaded: 'File uploaded',
  file_deleted: 'File removed',
};

export function ActivityFeed({ items }: Props) {
  if (items.length === 0) {
    return <p className="activity-feed__empty">No activity yet.</p>;
  }

  return (
    <ul className="activity-feed">
      {items.map((a) => (
        <li key={a.activityId}>
          <span className="activity-feed__type">{TYPE_LABEL[a.type] || a.type}</span>
          <p>{a.summary}</p>
          <small>
            {a.actor && <>{a.actor} · </>}
            {formatTime(a.createdAt)}
          </small>
        </li>
      ))}
    </ul>
  );
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
