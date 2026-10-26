/** Pure helpers behind the event page's task list: filters, counts, and category grouping. */
import type { Comment, Task } from '../types';
import { getCategory, OPS_CATEGORIES, type OpsCategory } from './categories';

export type TaskFilter = 'all' | 'open' | 'unassigned' | 'done';

export const TASK_FILTERS: { id: TaskFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'done', label: 'Done' },
];

export function isDone(t: Task): boolean {
  return t.status === 'done';
}

/** A task still needs an owner when it is open and nobody is assigned. */
export function needsOwner(t: Task): boolean {
  return !isDone(t) && !t.assigneeEmail && !t.assigneeName;
}

export function matchesFilter(t: Task, filter: TaskFilter): boolean {
  if (filter === 'open') return !isDone(t);
  if (filter === 'unassigned') return needsOwner(t);
  if (filter === 'done') return isDone(t);
  return true;
}

export function filterCounts(tasks: Task[]): Record<TaskFilter, number> {
  return {
    all: tasks.length,
    open: tasks.filter((t) => matchesFilter(t, 'open')).length,
    unassigned: tasks.filter((t) => matchesFilter(t, 'unassigned')).length,
    done: tasks.filter((t) => matchesFilter(t, 'done')).length,
  };
}

/** Dot colour for a category marker. */
export function categoryDot(cat: OpsCategory): string {
  return cat.dot ?? cat.color;
}

export interface TaskGroup {
  cat: OpsCategory;
  /** Every task in the category (drives the "done/total" progress). */
  all: Task[];
  /** The ones passing the current filter. */
  visible: Task[];
}

/**
 * Groups tasks by operational category, in the canonical category order. A task whose category isn't a known
 * one is shown under General rather than dropped.
 */
export function groupTasksByCategory(tasks: Task[], filter: TaskFilter): TaskGroup[] {
  const known = new Set(OPS_CATEGORIES.map((c) => c.id.toLowerCase()));
  const catId = (t: Task) => {
    const id = (t.category || 'General').toLowerCase();
    return known.has(id) ? id : 'general';
  };
  return OPS_CATEGORIES.map((cat) => {
    const all = tasks.filter((t) => catId(t) === cat.id.toLowerCase());
    return { cat, all, visible: all.filter((t) => matchesFilter(t, filter)) };
  }).filter((g) => g.visible.length > 0);
}

/** Note count per task for the "✎ N" badge; `internal` is true when any of them is admin-only. */
export function noteStatsByTask(comments: Comment[]): Record<string, { count: number; internal: boolean }> {
  const stats: Record<string, { count: number; internal: boolean }> = {};
  for (const c of comments) {
    if (!c.taskId) continue;
    const s = (stats[c.taskId] ??= { count: 0, internal: false });
    s.count += 1;
    if (c.visibility === 'internal') s.internal = true;
  }
  return stats;
}

/** Category for a task, falling back to General. */
export function taskCategory(t: Task): OpsCategory {
  return getCategory(t.category);
}

export function daysUntilDue(dueDate: string, today: Date = new Date()): number | null {
  if (!dueDate) return null;
  const d = new Date(dueDate.length === 10 ? `${dueDate}T12:00:00` : dueDate);
  if (isNaN(d.getTime())) return null;
  const a = new Date(today);
  a.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - a.getTime()) / 86_400_000);
}

export function isOverdue(t: Task, today: Date = new Date()): boolean {
  if (isDone(t)) return false;
  const days = daysUntilDue(t.dueDate, today);
  return days !== null && days < 0;
}

/** "19 Oct" — the compact due-date label used in task rows. */
export function shortDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
}

/** Display name for a raw category string ("AV" → "AV & Technical"); unknown ones keep their own text. */
export function categoryLabel(raw: string): string {
  const id = (raw || '').trim();
  if (!id) return 'Full event';
  return OPS_CATEGORIES.find((c) => c.id.toLowerCase() === id.toLowerCase())?.label ?? id;
}

/** Dot colour for a raw category string; unknown ones get the General colour. */
export function categoryDotFor(raw: string): string {
  return categoryDot(getCategory(raw));
}
