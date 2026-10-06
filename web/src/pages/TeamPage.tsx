import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTeamOverview } from '../api/client';
import { useUser } from '../context/UserContext';
import { fetchAndCacheMembers, getAssignableMembers, getMembers } from '../utils/roleStore';
import type { Task, TeamMember, TeamOverview } from '../types';
import './TeamPage.css';

interface AccountSummary {
  id: string;
  name: string;
  email: string;
  currentTasks: Task[];
  completedTasks: Task[];
}

/** Every org account (even ones with zero tasks right now), plus any legacy
 * name-only assignee buckets that don't match a roster account by email. */
function buildAccounts(team: TeamOverview): AccountSummary[] {
  const matchedEmails = new Set<string>();
  const result: AccountSummary[] = [];

  for (const member of getAssignableMembers()) {
    const match = member.email
      ? team.members.find((m) => m.email.toLowerCase() === member.email.toLowerCase())
      : undefined;
    if (match) matchedEmails.add(match.email.toLowerCase());
    const tasks = match?.tasks ?? [];
    result.push({
      id: member.id,
      name: member.name || member.email,
      email: member.email,
      currentTasks: tasks.filter((t) => t.status !== 'done'),
      completedTasks: tasks.filter((t) => t.status === 'done'),
    });
  }

  const inactiveEmails = new Set(
    getMembers().filter((m) => m.status === 'inactive').map((m) => m.email.toLowerCase()),
  );

  for (const bucket of team.members) {
    if (bucket.name === 'Unassigned' && !bucket.email) continue;
    const key = bucket.email.toLowerCase();
    if (key && matchedEmails.has(key)) continue;
    if (key && inactiveEmails.has(key)) continue;
    result.push({
      id: bucket.email || bucket.name,
      name: bucket.name,
      email: bucket.email,
      currentTasks: bucket.tasks.filter((t) => t.status !== 'done'),
      completedTasks: bucket.tasks.filter((t) => t.status === 'done'),
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

function unassignedTasksOf(team: TeamOverview): Task[] {
  const bucket = team.members.find((m: TeamMember) => m.name === 'Unassigned' && !m.email);
  return bucket?.tasks ?? [];
}

function TaskRow({ task }: { task: Task }) {
  return (
    <li>
      <Link to={`/event/${encodeURIComponent(task.eventCode)}`}>
        <strong>{task.eventCode}</strong> — {task.title}
      </Link>
      <span className={`team__status team__status--${task.status}`}>{task.status.replace('_', ' ')}</span>
    </li>
  );
}

function Disclosure({
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="team__disclosure">
      <button type="button" className="team__disclosure-header" onClick={onToggle} aria-expanded={expanded}>
        <span>{title}</span>
        <span className="team__disclosure-right">
          <span className="team__disclosure-count">{count}</span>
          <span className={`team__disclosure-chevron${expanded ? ' team__disclosure-chevron--open' : ''}`}>›</span>
        </span>
      </button>
      {expanded && children}
    </div>
  );
}

/** Admin-only for now. */
export function TeamPage() {
  const { isAdmin, isReady } = useUser();
  if (!isReady) return <p className="team__msg">Loading team…</p>;
  if (!isAdmin) {
    return (
      <p className="team__msg">
        This page is only available to admins. <Link to="/">← Back to Events</Link>
      </p>
    );
  }
  return <TeamPageContent />;
}

function TeamPageContent() {
  const [team, setTeam] = useState<TeamOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [unassignedOpen, setUnassignedOpen] = useState(false);
  const [openCompleted, setOpenCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Refresh the roster first so an account deactivated since this browser
    // last synced is already excluded when the list is built.
    fetchAndCacheMembers()
      .then(fetchTeamOverview)
      .then(setTeam)
      .finally(() => setLoading(false));
  }, []);

  const accounts = useMemo(() => (team ? buildAccounts(team) : []), [team]);
  const unassignedTasks = useMemo(() => (team ? unassignedTasksOf(team) : []), [team]);

  if (loading) return <p className="team__msg">Loading team…</p>;
  if (!team) return <p className="team__msg">No team data.</p>;

  function toggleCompleted(id: string) {
    setOpenCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="team">
      <header>
        <h1>Team</h1>
        <p>Who is working on what across all events.</p>
      </header>

      <div className="team__stats">
        <div className="team__stat">
          <strong>{team.totalTasks}</strong>
          <span>Total tasks</span>
        </div>
        <div className="team__stat">
          <strong>{team.openTasks}</strong>
          <span>Open tasks</span>
        </div>
        <div className="team__stat">
          <strong>{accounts.length}</strong>
          <span>Contributors</span>
        </div>
      </div>

      {unassignedTasks.length > 0 && (
        <Disclosure
          title="Unassigned"
          count={unassignedTasks.length}
          expanded={unassignedOpen}
          onToggle={() => setUnassignedOpen((o) => !o)}
        >
          <ul className="team__disclosure-list">
            {unassignedTasks.map((t) => (
              <TaskRow key={t.taskId} task={t} />
            ))}
          </ul>
        </Disclosure>
      )}

      <h2 className="team__section-title">Accounts</h2>

      <div className="team__members">
        {accounts.map((account) => (
          <article key={account.id} className="team__card">
            <div className="team__account-header">
              <span className="team__avatar">{(account.name || '?').charAt(0).toUpperCase()}</span>
              <div>
                <h2>{account.name}</h2>
                {account.email && <p className="team__email">{account.email}</p>}
              </div>
              <div className="team__account-counts">
                <strong>{account.currentTasks.length} current</strong>
                <span>{account.completedTasks.length} done</span>
              </div>
            </div>

            {account.currentTasks.length === 0 && account.completedTasks.length === 0 && (
              <p className="team__no-tasks">No tasks assigned.</p>
            )}

            {account.currentTasks.length > 0 && (
              <ul>
                {account.currentTasks.map((t) => (
                  <TaskRow key={t.taskId} task={t} />
                ))}
              </ul>
            )}

            {account.completedTasks.length > 0 && (
              <Disclosure
                title="Completed"
                count={account.completedTasks.length}
                expanded={openCompleted.has(account.id)}
                onToggle={() => toggleCompleted(account.id)}
              >
                <ul className="team__disclosure-list">
                  {account.completedTasks.map((t) => (
                    <TaskRow key={t.taskId} task={t} />
                  ))}
                </ul>
              </Disclosure>
            )}
          </article>
        ))}
        {accounts.length === 0 && (
          <p className="team__msg">Open an event workspace to create tasks and assign teammates.</p>
        )}
      </div>
    </div>
  );
}
