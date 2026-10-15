import type { Task } from '../../types';

export function doneCount(tasks: Task[]): number {
  return tasks.filter((t) => t.status === 'done').length;
}

export function readinessPct(tasks: Task[]): number {
  return tasks.length ? Math.round((doneCount(tasks) / tasks.length) * 100) : 0;
}
