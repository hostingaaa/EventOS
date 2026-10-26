import type { Task } from '../../types';
import { formatIsoDate } from '../../utils/dateFormat';
import {
  categoryDot,
  filterCounts,
  groupTasksByCategory,
  isDone,
  isOverdue,
  shortDate,
  TASK_FILTERS,
  type TaskFilter,
} from '../../utils/taskView';
import { STATUS_PILL } from './statusPill';

interface Props {
  tasks: Task[];
  filter: TaskFilter;
  onFilterChange: (filter: TaskFilter) => void;
  selectedTaskId: string | null;
  onSelect: (taskId: string) => void;
  /** Signed-in user's email (null when signed out). */
  currentUserEmail: string | null;
  isAdmin: boolean;
  noteStats: Record<string, { count: number; internal: boolean }>;
  onToggleComplete: (task: Task) => void;
  onAddTask?: () => void;
}

/** Filterable, category-grouped task list. Completing a task is limited to its assignee or an admin. */
export function TaskList({
  tasks,
  filter,
  onFilterChange,
  selectedTaskId,
  onSelect,
  currentUserEmail,
  isAdmin,
  noteStats,
  onToggleComplete,
  onAddTask,
}: Props) {
  const counts = filterCounts(tasks);
  const groups = groupTasksByCategory(tasks, filter);

  return (
    <section className="ws-tasklist">
      <div className="ws-tasklist__filters">
        {TASK_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`ws-chip${filter === f.id ? ' ws-chip--on' : ''}`}
            onClick={() => onFilterChange(f.id)}
            aria-pressed={filter === f.id}
          >
            {f.label}
            <span>{counts[f.id]}</span>
          </button>
        ))}
        {onAddTask && (
          <button type="button" className="ws-link-btn ws-tasklist__add" onClick={onAddTask}>
            + Add task
          </button>
        )}
      </div>

      <div className="ws-tasklist__cols" aria-hidden="true">
        <span />
        <span>Task</span>
        <span>Owner</span>
        <span>Due</span>
        <span>Status</span>
      </div>

      {groups.map(({ cat, all, visible }) => (
        <div key={cat.id} className="ws-group">
          <div className="ws-group__head">
            <span className="ws-dot" style={{ background: categoryDot(cat) }} />
            <span className="ws-group__label">{cat.label}</span>
            <span className="ws-group__progress">
              {all.filter(isDone).length}/{all.length}
            </span>
          </div>

          {visible.map((task) => {
            const done = isDone(task);
            const selected = selectedTaskId === task.taskId;
            const pill = STATUS_PILL[task.status] ?? STATUS_PILL.todo;
            const isAssignee =
              !!currentUserEmail && !!task.assigneeEmail && task.assigneeEmail.toLowerCase() === currentUserEmail.toLowerCase();
            const canToggle = done ? isAdmin : isAdmin || isAssignee;
            const checkTip = done
              ? isAdmin
                ? 'Re-open task'
                : `Completed by ${task.completedBy || 'someone'}`
              : canToggle
                ? 'Mark as complete'
                : task.assigneeName
                  ? `Only ${task.assigneeName} can complete this task`
                  : 'Assign this task first, then mark it complete';
            const notes = noteStats[task.taskId];
            const overdue = isOverdue(task);
            const preview = (task.instructions || '').split('\n')[0];

            return (
              <div
                key={task.taskId}
                className={`ws-row${selected ? ' ws-row--selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                onClick={() => onSelect(task.taskId)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(task.taskId);
                  }
                }}
              >
                <button
                  type="button"
                  className={`ws-check${done ? ' ws-check--done' : ''}`}
                  aria-label={checkTip}
                  title={checkTip}
                  disabled={!canToggle}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleComplete(task);
                  }}
                >
                  {done ? '✓' : ''}
                </button>

                <div className="ws-row__main">
                  <div className="ws-row__titleline">
                    <span className={`ws-row__title${done ? ' ws-row__title--done' : ''}`}>{task.title}</span>
                    {notes && (
                      <span
                        className={`ws-row__notes${notes.internal ? ' ws-row__notes--internal' : ''}`}
                        title={`${notes.count} note${notes.count === 1 ? '' : 's'}`}
                      >
                        ✎ {notes.count}
                      </span>
                    )}
                  </div>
                  {preview && <div className="ws-row__desc">{preview}</div>}
                </div>

                <div className="ws-row__owner">
                  {task.assigneeName || task.assigneeEmail ? (
                    <>
                      <span className="ws-avatar">{(task.assigneeName || task.assigneeEmail).charAt(0).toUpperCase()}</span>
                      <span className="ws-row__owner-name">{task.assigneeName || task.assigneeEmail}</span>
                    </>
                  ) : (
                    <>
                      <span className="ws-avatar ws-avatar--empty" />
                      <span className="ws-row__owner-name ws-row__owner-name--empty">Unassigned</span>
                    </>
                  )}
                </div>

                <span
                  className={`ws-row__due${task.dueDate ? '' : ' ws-row__due--none'}${overdue ? ' ws-row__due--overdue' : ''}`}
                  title={task.dueDate ? `${overdue ? 'Overdue — ' : 'Due '}${formatIsoDate(task.dueDate.slice(0, 10))}` : undefined}
                >
                  {task.dueDate ? shortDate(task.dueDate) : '—'}
                </span>

                <span className={`ws-status ws-status--${pill.cls}`}>{pill.label}</span>
              </div>
            );
          })}
        </div>
      ))}

      {groups.length === 0 && <div className="ws-tasklist__empty">No tasks match this filter.</div>}
    </section>
  );
}
