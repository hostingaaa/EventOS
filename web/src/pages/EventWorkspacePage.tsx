import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { deleteEvent, fetchWorkspace, updateEvent, updateTask } from '../api/client';
import { useUser } from '../context/UserContext';
import type { ActivityItem, Comment, CostItem, Event, Task, TaskFile, WorkspaceData } from '../types';
import { EditEventModal } from '../components/EditEventModal';
import { ApplyTemplatesModal } from '../components/templates/ApplyTemplatesModal';
import { ActivityTab } from '../components/event/ActivityTab';
import { AddTaskModal } from '../components/event/AddTaskModal';
import { DetailsTab } from '../components/event/DetailsTab';
import { DuplicateEventModal } from '../components/event/DuplicateEventModal';
import { EventHeader } from '../components/event/EventHeader';
import { FinancialsTab } from '../components/event/FinancialsTab';
import { LinksTab } from '../components/event/LinksTab';
import { SummaryCards } from '../components/event/SummaryCards';
import { TasksTab } from '../components/event/TasksTab';
import { useVendorLinks } from '../components/event/useVendorLinks';
import { VendorLinkModal } from '../components/event/VendorLinkModal';
import { getEventStatus, type EventStatus } from '../utils/eventLifecycle';
import { categoryLabel, type TaskFilter } from '../utils/taskView';
import '../components/event/Panels.css';
import './EventWorkspacePage.css';

type Tab = 'tasks' | 'details' | 'financials' | 'activity' | 'links';

const TABS: Tab[] = ['tasks', 'details', 'financials', 'activity', 'links'];
const TAB_LABELS: Record<Tab, string> = {
  tasks: 'Tasks',
  details: 'Details',
  financials: 'Financials',
  activity: 'Activity',
  links: 'Links',
};

/** `?tab=` values, including the name the Details tab used before the redesign. */
function tabFromParam(param: string | null): Tab {
  if (param === 'overview') return 'details';
  return TABS.includes(param as Tab) ? (param as Tab) : 'tasks';
}

export function EventWorkspacePage() {
  const { eventCode } = useParams<{ eventCode: string }>();
  const code = decodeURIComponent(eventCode || '');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [data, setData] = useState<WorkspaceData | null>(null);
  const [tab, setTab] = useState<Tab>(() => tabFromParam(searchParams.get('tab')));
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const { user, isAdmin, can } = useUser();
  const actorEmail = user?.email ?? '';

  const vendorLinks = useVendorLinks(code, data?.event.rowId ?? '', actorEmail);

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const ws = await fetchWorkspace(code, '', actorEmail);
      setData(ws);
      setSelectedTaskId((prev) => {
        // Only keep the prior selection if the task belongs to the newly-loaded event.
        if (prev && ws.tasks.some((t) => t.taskId === prev)) return prev;
        return ws.tasks[0]?.taskId ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  }, [code, actorEmail]);

  // Reset all event-scoped state whenever the URL event code changes so we
  // never display data from a previously-opened project.
  useEffect(() => {
    setData(null);
    setSelectedTaskId(null);
    setError(null);
    load();
  }, [code, load]);

  /** Re-reads just the activity feed, so the Activity tab shows what the user did since the page loaded. */
  const refreshActivity = useCallback(async () => {
    if (!code) return;
    try {
      const ws = await fetchWorkspace(code, '', actorEmail);
      setData((d) => (d ? { ...d, activity: ws.activity } : d));
    } catch {
      // Keep showing what we have.
    }
  }, [code, actorEmail]);

  const handleEventUpdated = (event: Event) => setData((d) => (d ? { ...d, event } : d));
  const handleTaskUpdated = (task: Task) =>
    setData((d) => (d ? { ...d, tasks: d.tasks.map((t) => (t.taskId === task.taskId ? task : t)) } : d));
  const handleCommentAdded = (comment: Comment) => setData((d) => (d ? { ...d, comments: [...d.comments, comment] } : d));
  const handleFileAdded = (file: TaskFile) => setData((d) => (d ? { ...d, files: [...d.files, file] } : d));
  const handleFileRemoved = (fileId: string) => setData((d) => (d ? { ...d, files: d.files.filter((f) => f.fileId !== fileId) } : d));
  const handleCostItemAdded = (item: CostItem) => setData((d) => (d ? { ...d, costItems: [...(d.costItems ?? []), item] } : d));
  const handleCostItemUpdated = (item: CostItem) =>
    setData((d) => (d ? { ...d, costItems: (d.costItems ?? []).map((c) => (c.costItemId === item.costItemId ? item : c)) } : d));
  const handleCostItemDeleted = (costItemId: string) =>
    setData((d) => (d ? { ...d, costItems: (d.costItems ?? []).filter((c) => c.costItemId !== costItemId) } : d));

  const handleToggleComplete = async (task: Task) => {
    if (!user) return;
    try {
      const updated = await updateTask(task.taskId, { status: task.status === 'done' ? 'in_progress' : 'done' }, user.email);
      handleTaskUpdated(updated);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not update the task');
    }
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
  const taskCategories = Array.from(new Set(tasks.map((t) => (t.category || '').trim()).filter(Boolean))).sort();
  const status = getEventStatus(event);
  const selectedTask = tasks.find((t) => t.taskId === selectedTaskId) ?? null;
  const links = vendorLinks.links;
  const hasFullEventLink = links.some((l) => !l.vendorCategory);
  const usedCategories = new Set(links.map((l) => l.vendorCategory).filter((c): c is string => !!c));
  const canShare = !!user;

  async function handleStatusChange(next: EventStatus) {
    if (!user?.email || next === status) return;
    setSavingStatus(true);
    try {
      handleEventUpdated(await updateEvent(event.rowId, event.code, { status: next }, user.email));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleDeleteEvent() {
    if (!user?.email || !can('events.delete')) return;
    const label = event.code + (event.location ? ` — ${event.location}` : '');
    if (!confirm(`Delete "${label}" permanently?\n\nThis removes the event and its tasks from the dashboard. This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await deleteEvent(event.rowId, event.code, user.email);
      navigate('/');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete event');
      setDeleting(false);
    }
  }

  async function handleFullEventLink() {
    try {
      await vendorLinks.create({});
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create the vendor link');
    }
  }

  async function confirmAndRun(link: (typeof links)[number], verb: 'regenerate' | 'revoke') {
    const message =
      verb === 'revoke'
        ? `Revoke the link for ${link.label}? Anyone using it will lose access.`
        : 'This will invalidate the existing link and create a new one. Continue?';
    if (!confirm(message)) return;
    try {
      await (verb === 'revoke' ? vendorLinks.revoke(link) : vendorLinks.regenerate(link));
    } catch {
      // The hook keeps the message in vendorLinks.error, which the Links tab shows.
    }
  }

  function openTab(next: Tab) {
    setTab(next);
    if (next === 'activity') void refreshActivity();
  }

  const tabCounts: Partial<Record<Tab, number>> = { tasks: tasks.length, activity: activity.length, links: links.length };

  return (
    <div className="workspace">
      <nav className="workspace__breadcrumb">
        <Link to="/">Events</Link>
        <span>/</span>
        <strong>{event.code}</strong>
      </nav>

      <EventHeader
        event={event}
        status={status}
        canChangeStatus={isAdmin}
        savingStatus={savingStatus}
        onStatusChange={handleStatusChange}
        canEdit={!!user && isAdmin}
        onEdit={() => setShowEditModal(true)}
        canAddTemplates={!!user}
        onAddTemplates={() => setShowApplyModal(true)}
        canDuplicate={!!user && can('events.create')}
        onDuplicate={() => setShowDuplicate(true)}
        canDelete={can('events.delete')}
        deleting={deleting}
        onDelete={handleDeleteEvent}
      />

      <SummaryCards
        tasks={tasks}
        location={event.location}
        links={links}
        canShare={canShare}
        selectedCategoryLabel={selectedTask ? categoryLabel(selectedTask.category) : null}
        onShowUnassigned={() => {
          setTaskFilter('unassigned');
          setTab('tasks');
        }}
        onNewVendorLink={() => setShowLinkModal(true)}
        onFullEventLink={handleFullEventLink}
        onViewLinks={() => setTab('links')}
        linkBusy={vendorLinks.busy}
        hasFullEventLink={hasFullEventLink}
      />

      <div className="workspace__tabs" role="tablist">
        {TABS.map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => openTab(id)}>
            {TAB_LABELS[id]}
            {tabCounts[id] != null && <span className="workspace__tab-count">{tabCounts[id]}</span>}
          </button>
        ))}
      </div>

      {tab === 'tasks' && tasks.length === 0 && (
        <div className="workspace__empty-tasks">
          <strong>No operational tasks yet</strong>
          <p>
            Apply reusable LEM task templates — AV setup, interpretation, venue coordination, registration, and more — to
            generate the task list for this event, or add tasks one at a time.
          </p>
          {user && (
            <div className="workspace__empty-actions">
              <button type="button" className="ws-pill ws-pill--solid ws-pill--lg" onClick={() => setShowApplyModal(true)}>
                Apply operational templates
              </button>
              <button type="button" className="ws-pill ws-pill--outline ws-pill--lg" onClick={() => setShowAddTask(true)}>
                + Add task
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'tasks' && tasks.length > 0 && (
        <TasksTab
          tasks={tasks}
          comments={comments}
          files={files}
          filter={taskFilter}
          onFilterChange={setTaskFilter}
          selectedTaskId={selectedTaskId}
          onSelect={setSelectedTaskId}
          currentUserEmail={user?.email ?? null}
          isAdmin={isAdmin}
          onToggleComplete={handleToggleComplete}
          onAddTask={user ? () => setShowAddTask(true) : undefined}
          onTaskUpdated={handleTaskUpdated}
          onCommentAdded={handleCommentAdded}
          onFileAdded={handleFileAdded}
          onFileRemoved={handleFileRemoved}
        />
      )}

      {tab === 'details' && (
        <DetailsTab event={event} eventComments={eventComments} onEventUpdated={handleEventUpdated} onCommentAdded={handleCommentAdded} />
      )}

      {tab === 'financials' && user && (
        <FinancialsTab
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

      {tab === 'activity' && <ActivityTab items={activity as ActivityItem[]} />}

      {tab === 'links' && (
        <LinksTab
          eventCode={event.code}
          links={links}
          busy={vendorLinks.busy}
          error={vendorLinks.error}
          canManage={canShare}
          hasFullEventLink={hasFullEventLink}
          onNewVendorLink={() => setShowLinkModal(true)}
          onFullEventLink={handleFullEventLink}
          onRegenerate={(l) => void confirmAndRun(l, 'regenerate')}
          onRevoke={(l) => void confirmAndRun(l, 'revoke')}
        />
      )}

      {showEditModal && user && isAdmin && (
        <EditEventModal event={event} actorEmail={user.email} onSaved={handleEventUpdated} onClose={() => setShowEditModal(false)} />
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

      {showAddTask && user && (
        <AddTaskModal
          eventCode={event.code}
          eventRowId={event.rowId}
          actorEmail={user.email}
          defaultCategory={selectedTask?.category || 'General'}
          onCreated={(task) => {
            setData((d) => (d ? { ...d, tasks: [...d.tasks, task] } : d));
            setSelectedTaskId(task.taskId);
            setTaskFilter('all');
            setTab('tasks');
          }}
          onClose={() => setShowAddTask(false)}
        />
      )}

      {showDuplicate && user && (
        <DuplicateEventModal
          event={event}
          actorEmail={user.email}
          onDuplicated={(copy) => navigate(`/event/${encodeURIComponent(copy.code)}`)}
          onClose={() => setShowDuplicate(false)}
        />
      )}

      {showLinkModal && user && (
        <VendorLinkModal
          eventCode={event.code}
          categories={taskCategories}
          usedCategories={usedCategories}
          initialCategory={selectedTask?.category}
          onCreate={vendorLinks.create}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}
