/** Label + style key for each task status, shared by the task list pill and the aside's status control. */
export const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  todo: { label: 'To do', cls: 'todo' },
  in_progress: { label: 'In progress', cls: 'progress' },
  blocked: { label: 'Blocked', cls: 'blocked' },
  done: { label: 'Done', cls: 'done' },
};
