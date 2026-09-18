import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { deleteEvent, fetchWorkspace, updateEvent, updateTask } from '../api/client';
import { useUser } from '../context/UserContext';
import type { Comment, CostItem, Task, TaskFile, WorkspaceData } from '../types';
import { OpsTaskList } from '../components/tasks/OpsTaskList';
import { TaskPanel } from '../components/tasks/TaskPanel';
import { ActivityFeed } from '../components/collaboration/ActivityFeed';
import { CommentThread } from '../components/collaboration/CommentThread';
import { EventDetail } from '../components/EventDetail';
import { ApplyTemplatesModal } from '../components/templates/ApplyTemplatesModal';
import { VendorSharePanel } from '../components/vendor/VendorSharePanel';
import { FinancialsPanel } from '../components/FinancialsPanel';
import { formatEventHeaderDates } from '../utils/calendarDates';
import { archiveEvent, getArchivedCodes, isEventAwarded, isEventCompleted, unarchiveEvent } from '../utils/eventLifecycle';
import './EventWorkspacePage.css';

type Tab = 'tasks' | 'overview' | 'financials' | 'activity';

export function EventWorkspacePage() {
  const { eventCode } = useParams<{ eventCode: string }>();
  const code = decodeURIComponent(eventCode || '');
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const validTabs: Tab[] = ['tasks', 'overview', 'financials', 'activity'];
  const requestedTab = searchParams.get('tab');
  const initialTab: Tab = validTabs.includes(requestedTab as Tab) ? (requestedTab as Tab) : 'tasks';

  const [data, setData] = useState<WorkspaceData | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [archivedCodes, setArchivedCodes] = useState<Set<string>>(getArchivedCodes);
  const [deleting, setDeleting] = useState(false);
  const [savingAwarded, setSavingAwarded] = useState(false);
  const { user, isAdmin, can } = useUser();

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const ws = await fetchWorkspace(code, '');
      setData(ws);
      setSelectedTaskId((prev) => {
        // Only keep prior selection if the task belongs to the newly-loaded event
        if (prev && ws.tasks.some((t) => t.taskId === prev)) return prev;
        return ws.tasks[0]?.taskId ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }, [code]);

  // Reset all event-scoped state whenever the URL event code changes so we
  // never display data from a previously-opened project.
  useEffect(() => {
    setData(null);
    setSelectedTaskId(null);
    setError(null);
    load();
  }, [code, load]);

  const selectedTask = data?.tasks.find((t) => t.taskId === selectedTaskId) ?? null;

  const handleEventUpdated = (event: WorkspaceData['event']) => {
    setData((d) => (d ? { ...d, event } : d));
  };

  const handleTaskUpdated = (task: Task) => {
    setData((d) =>
      d ? { ...d, tasks: d.tasks.map((t) => (t.taskId === task.taskId ? task : t)) } : d,
    );
  };

  const handleCommentAdded = (comment: Comment) => {
    setData((d) => (d ? { ...d, comments: [...d.comments, comment] } : d));
  };

  const handleFileAdded = (file: TaskFile) => {
    setData((d) => (d ? { ...d, files: [...d.files, file] } : d));
  };

  const handleFileRemoved = (fileId: string) => {
    setData((d) => (d ? { ...d, files: d.files.filter((f) => f.fileId !== fileId) } : d));
  };

  const handleCostItemAdded = (item: CostItem) => {
    setData((d) => (d ? { ...d, costItems: [...d.costItems, item] } : d));
  };

  const handleCostItemUpdated = (item: CostItem) => {
    setData((d) =>
      d ? { ...d, costItems: d.costItems.map((c) => (c.costItemId === item.costItemId ? item : c)) } : d,
    );
  };

  const handleCostItemDeleted = (costItemId: string) => {
    setData((d) => (d ? { ...d, costItems: d.costItems.filter((c) => c.costItemId !== costItemId) } : d));
  };

  const handleToggleComplete = async (task: Task) => {
    if (!user) return;
    const newStatus = task.status === 'done' ? 'in_progress' : 'done';
    const updated = await updateTask(task.taskId, { status: newStatus }, user.email);
    handleTaskUpdated(updated);
  };

  if (loading) return <p className="workspace__msg">Loading workspace…</p>;
  if (error || !data) {
    return (
      <div className="workspace__msg workspace__msg--err">
        {error || 'Not found'}
        <br />
        <Link to="/">← Back to events</Link>
      </div>
    );
  }

  const { event, tasks, comments, files, activity } = data;
  const costItems = data.costItems ?? [];
  const eventComments = comments.filter((c) => !c.taskId);
  const taskCategories = Array.from(new Set(tasks.map((t) => t.category).filter(Boolean)));
  const canDelete = can('events.delete');
  const completed = isEventCompleted(event, archivedCodes);
  const awarded = isEventAwarded(event);

  function handleArchiveToggle() {
    setArchivedCodes(completed ? unarchiveEvent(event.code) : archiveEvent(event.code));
  }

  async function handleAwardedToggle() {
    if (!user?.email) return;
    setSavingAwarded(true);
    try {
      const updated = await updateEvent(event.rowId, event.code, { awarded: awarded ? '' : 'Yes' }, user.email);
      handleEventUpdated(updated);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update Awarded status');
    } finally {
      setSavingAwarded(false);
    }
  }

  async function handleDeleteEvent() {
    if (!user?.email || !canDelete) return;
    const label = event.code + (event.location ? ` — ${event.location}` : '');
    if (
      !confirm(
        `Delete "${label}" permanently?\n\nThis removes the event and its tasks from the dashboard. This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteEvent(event.rowId, event.code, user.email);
      unarchiveEvent(event.code);
      navigate('/');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete event');
      setDeleting(false);
    }
  }

  // Operational readiness stats
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const blockedTasks = tasks.filter((t) => t.status === 'blocked').length;
  const overdueTasks = tasks.filter((t) => {
    if (t.status === 'done' || !t.dueDate) return false;
    return new Date(t.dueDate) < new Date();
  }).length;
  const readinessPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="workspace">
      <nav className="workspace__breadcrumb">
        <Link to="/">Events</Link>
        <span>/</span>
        <strong>{event.code}</strong>
        <span className="workspace__meta">
          {event.location} · {formatEventHeaderDates(event)}
        </span>
      </nav>

      <header className="workspace__header">
        <div>
          <h1 className="workspace__title">
            <span>{event.code}</span>
            {awarded && <span className="workspace__awarded-badge">Awarded</span>}
            <span className="workspace__title-sep">—</span>
            <span>{event.location}</span>
          </h1>
          <p className="workspace__header-sub">{formatEventHeaderDates(event)}</p>
        </div>
        <div className="workspace__header-actions">
          {isAdmin && (
            <button
              type="button"
              className={`workspace__awarded-btn${awarded ? ' workspace__awarded-btn--on' : ''}`}
              onClick={handleAwardedToggle}
              disabled={savingAwarded}
              title={awarded ? 'Remove Awarded status' : 'Mark as Awarded'}
            >
              {savingAwarded ? 'Saving…' : awarded ? '✓ Awarded' : '☆ Mark as Awarded'}
            </button>
          )}
          {event.driveFolderUrl && (
            <a
              href={event.driveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="workspace__drive-link"
              title="Open event folder in Google Drive"
            >
              <svg width="15" height="15" viewBox="0 0 87.3 78" fill="none" aria-hidden="true" style={{marginRight:'0.35rem'}}>
                <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L28.5 51H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 46.5C.4 47.9 0 49.45 0 51h28.5z" fill="#00ac47"/>
                <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 55.5c.8-1.4 1.2-2.95 1.2-4.5H58.8L73.55 76.8z" fill="#ea4335"/>
                <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.95 0H34.35c-1.55 0-3.1.4-4.45 1.2z" fill="#00832d"/>
                <path d="M58.8 51H28.5L14.75 76.8c1.35.8 2.9 1.2 4.45 1.2h49c1.55 0 3.1-.4 4.45-1.2z" fill="#2684fc"/>
                <path d="M73.4 26.5L60.7 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 58.8 51h27.25c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
              Drive Folder
            </a>
          )}
          {user && (
            <button type="button" className="workspace__add-tasks" onClick={() => setShowApplyModal(true)}>
              + Add from templates
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className="workspace__archive-btn"
              onClick={handleArchiveToggle}
              title={completed ? 'Restore to active' : 'Archive event'}
            >
              {completed ? '↩ Restore to active' : '⊙ Archive event'}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="workspace__delete-btn"
              onClick={handleDeleteEvent}
              disabled={deleting}
              title="Delete event permanently"
            >
              {deleting ? 'Deleting…' : '✕ Delete event'}
            </button>
          )}
        </div>
      </header>

      {/* Operational readiness bar */}
      {totalTasks > 0 && (
        <div className="workspace__readiness">
          <div className="workspace__readiness-label">
            <span>Operational readiness</span>
            <strong>{readinessPct}%</strong>
          </div>
          <div className="workspace__readiness-track">
            <div
              className="workspace__readiness-fill"
              style={{ width: `${readinessPct}%` }}
            />
          </div>
          <div className="workspace__readiness-stats">
            <span className="ws-stat ws-stat--done">{doneTasks} complete</span>
            <span className="ws-stat">{totalTasks - doneTasks} remaining</span>
            {blockedTasks > 0 && (
              <span className="ws-stat ws-stat--blocked">{blockedTasks} blocked</span>
            )}
            {overdueTasks > 0 && (
              <span className="ws-stat ws-stat--overdue">{overdueTasks} overdue</span>
            )}
          </div>
        </div>
      )}

      {user && (
        <VendorSharePanel
          eventCode={event.code}
          eventRowId={event.rowId}
          actorEmail={user.email}
          tasks={tasks}
        />
      )}

      <div className="workspace__tabs">
        {(
          [
            ['tasks', 'Operational tasks'],
            ['overview', 'Event details'],
            ['financials', 'Financials'],
            ['activity', 'Activity log'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'tasks' && tasks.length === 0 && (
        <div className="workspace__empty-tasks">
          <div className="workspace__empty-icon" aria-hidden="true">📋</div>
          <strong>No operational tasks yet</strong>
          <p>
            Apply reusable LEM task templates — AV setup, interpretation, venue coordination,
            registration, and more — to auto-generate the task list for this event.
          </p>
          {user && (
            <button type="button" className="btn-primary" onClick={() => setShowApplyModal(true)}>
              Apply operational templates
            </button>
          )}
        </div>
      )}

      {tab === 'tasks' && tasks.length > 0 && (
        <div className="workspace__tasks-layout">
          <div className="workspace__board-wrap">
            <OpsTaskList
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              currentUserEmail={user?.email ?? null}
              isAdmin={isAdmin}
              onSelect={setSelectedTaskId}
              onToggleComplete={handleToggleComplete}
            />
          </div>
          <TaskPanel
            task={selectedTask}
            comments={comments}
            files={files}
            onTaskUpdated={handleTaskUpdated}
            onCommentAdded={handleCommentAdded}
            onFileAdded={handleFileAdded}
            onFileRemoved={handleFileRemoved}
          />
        </div>
      )}

      {tab === 'overview' && (
        <div className="workspace__overview">
          <EventDetail event={event} onUpdated={handleEventUpdated} />
          <section className="workspace__event-comments">
            <h3>Event-wide discussion</h3>
            <CommentThread
              comments={eventComments}
              eventCode={event.code}
              onAdded={handleCommentAdded}
            />
          </section>
        </div>
      )}

      {tab === 'financials' && user && (
        <FinancialsPanel
          event={event}
          costItems={costItems}
          categoriesInUse={taskCategories}
          isAdmin={isAdmin}
          actorEmail={user.email}
          onEventUpdated={handleEventUpdated}
          onCostItemAdded={handleCostItemAdded}
          onCostItemUpdated={handleCostItemUpdated}
          onCostItemDeleted={handleCostItemDeleted}
        />
      )}

      {tab === 'activity' && (
        <section className="workspace__activity">
          <h3>Recent activity</h3>
          <ActivityFeed items={activity} />
        </section>
      )}

      {showApplyModal && user && (
        <ApplyTemplatesModal
          eventCode={event.code}
          eventRowId={event.rowId}
          actorEmail={user.email}
          onApplied={load}
          onClose={() => setShowApplyModal(false)}
        />
      )}
    </div>
  );
}
