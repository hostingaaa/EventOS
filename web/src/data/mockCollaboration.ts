import type {
  ActivityItem,
  Comment,
  Task,
  TaskFile,
  TeamOverview,
  VendorWorkspaceData,
  WorkspaceData,
} from '../types';
import { findMockEvent } from './mockEvents';
import { getMockTemplate } from './mockTemplates';
import {
  appendComment,
  appendFile,
  appendTask,
  getActivityFor,
  getCommentsFor,
  getFilesByTask,
  getFilesForEvent,
  getMockState,
  getTasksFor,
  getVendorLinkByEvent,
  getVendorLinkByToken,
  pushActivity,
  removeFile,
  updateTaskById,
} from './mockStore';
import { computeDueDate, renderTemplateString } from '../utils/templateVars';

export function getMockWorkspace(eventCode: string, eventRowId: string): WorkspaceData {
  const event = findMockEvent({ code: eventCode, rowId: eventRowId });
  if (!event) throw new Error('Event not found');

  const tasks = getTasksFor(event.code);
  const comments = getCommentsFor(event.code);
  const files: TaskFile[] = [];
  tasks.forEach((t) => {
    files.push(...getFilesByTask(t.taskId));
  });

  return {
    event,
    tasks,
    comments,
    files,
    activity: getActivityFor(event.code),
    vendorLink: getVendorLinkByEvent(event.code),
    costItems: [],
  };
}

export function applyMockTemplates(
  eventCode: string,
  eventRowId: string,
  templateIds: string[],
): Task[] {
  const created: Task[] = [];
  const now = new Date().toISOString();
  const event = findMockEvent({ code: eventCode, rowId: eventRowId });

  templateIds.forEach((templateId, i) => {
    const data = getMockTemplate(templateId);
    if (!data) return;
    const tmpl = data.template;

    const ctx = event ? { event } : null;

    const title = ctx ? renderTemplateString(tmpl.title, ctx) : tmpl.title;
    const instructions = ctx
      ? renderTemplateString(tmpl.instructions, ctx)
      : tmpl.instructions;
    const dueDate =
      ctx && tmpl.dueOffsetDays !== undefined
        ? computeDueDate(ctx.event.startDate, Number(tmpl.dueOffsetDays))
        : '';

    const task: Task = {
      taskId: `mock-task-${eventCode}-${templateId}-${Date.now()}-${i}`,
      eventCode,
      eventRowId,
      title,
      category: tmpl.category,
      status: 'todo',
      assigneeEmail: tmpl.defaultAssigneeEmail,
      assigneeName: tmpl.defaultAssigneeName,
      dueDate,
      instructions,
      templateId: tmpl.templateId,
      vendorVisible: 'yes',
      createdAt: now,
      updatedAt: now,
      createdBy: 'template',
    };
    appendTask(task);

    data.files.forEach((tf, j) => {
      appendFile({
        fileId: `f-${task.taskId}-${j}`,
        eventCode,
        taskId: task.taskId,
        fileName: tf.fileName,
        mimeType: tf.mimeType,
        driveFileId: '',
        driveUrl: tf.driveUrl,
        uploadedBy: 'template',
        uploadedAt: now,
        sizeBytes: tf.sizeBytes,
      });
    });
    created.push(task);
  });

  if (created.length) {
    pushActivity({
      activityId: 'a-' + Date.now(),
      type: 'templates_applied',
      eventCode,
      taskId: '',
      summary: `${created.length} tasks from templates`,
      actor: '',
      createdAt: now,
    });
  }

  return created;
}

/**
 * Strict per-event vendor workspace.
 *
 * Resolves the event ONLY via the persisted vendor-link table. If no matching
 * link exists, this throws — it does NOT fall back to another event. This is
 * what guarantees that each shareable link only ever shows the data for the
 * specific project it was generated for.
 */
export function getMockVendorWorkspace(token: string): VendorWorkspaceData {
  const link = getVendorLinkByToken(token);
  if (!link) {
    throw new Error(
      'This vendor link is invalid or has been regenerated. Ask the project owner for a new link.',
    );
  }

  const event = findMockEvent({ code: link.eventCode, rowId: link.eventRowId });
  if (!event) {
    throw new Error(
      `Vendor link points to event ${link.eventCode}, which no longer exists.`,
    );
  }

  // Defence in depth: only this event's vendor-visible tasks
  let tasks = getTasksFor(event.code).filter((t) => t.vendorVisible !== 'no');

  // Per-category scoping: if the link is tied to a vendor category,
  // only show tasks in that category. Empty category = full-event link.
  if (link.vendorCategory) {
    const cat = link.vendorCategory.toLowerCase();
    tasks = tasks.filter((t) => (t.category || '').toLowerCase() === cat);
  }

  const visibleTaskIds = new Set(tasks.map((t) => t.taskId));
  const files = getFilesForEvent(event.code).filter((f) => visibleTaskIds.has(f.taskId));

  return {
    event: {
      code: event.code,
      location: event.location,
      dates: event.dates,
      venue: event.venue,
      monthGroup: event.monthGroup,
    },
    tasks: tasks.map((t) => ({
      taskId: t.taskId,
      title: t.title,
      category: t.category,
      instructions: t.instructions,
      status: t.status,
    })),
    files: files.map((f) => ({
      fileId: f.fileId,
      taskId: f.taskId,
      fileName: f.fileName,
      mimeType: f.mimeType,
      driveUrl: f.driveUrl,
      sizeBytes: f.sizeBytes,
    })),
    linkLabel: link.label || 'Vendor portal',
    vendorCategory: link.vendorCategory,
    vendorName: link.vendorName,
    permission: link.permission,
  };
}

export function updateMockTask(taskId: string, updates: Partial<Task>, actorEmail?: string): Task {
  const existing = getMockState().tasksByEvent;
  // Find the task to check previous status
  let prev: Task | undefined;
  for (const tasks of Object.values(existing)) {
    prev = tasks.find((t) => t.taskId === taskId);
    if (prev) break;
  }

  // Auto-manage completion fields
  const enriched = { ...updates };
  if (updates.status === 'done' && prev?.status !== 'done') {
    enriched.completedBy = actorEmail || '';
    enriched.completedAt = new Date().toISOString();
  } else if (updates.status && updates.status !== 'done' && prev?.status === 'done') {
    enriched.completedBy = '';
    enriched.completedAt = '';
  }

  const updated = updateTaskById(taskId, enriched);
  if (!updated) throw new Error('Task not found');
  return updated;
}

export function addMockComment(payload: {
  eventCode: string;
  taskId?: string;
  authorEmail: string;
  authorName: string;
  body: string;
}): Comment {
  const c: Comment = {
    commentId: 'c-' + Date.now(),
    eventCode: payload.eventCode,
    taskId: payload.taskId || '',
    authorEmail: payload.authorEmail,
    authorName: payload.authorName,
    body: payload.body,
    createdAt: new Date().toISOString(),
  };
  appendComment(c);
  return c;
}

export function addMockFile(
  taskId: string,
  eventCode: string,
  file: File,
  uploadedBy: string,
): TaskFile {
  const f: TaskFile = {
    fileId: 'f-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    eventCode,
    taskId,
    fileName: file.name,
    mimeType: file.type,
    driveFileId: '',
    driveUrl: URL.createObjectURL(file),
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    sizeBytes: file.size,
  };
  appendFile(f);
  return f;
}

export function deleteMockFile(fileId: string): void {
  removeFile(fileId);
}

export function getMockTeamOverview(): TeamOverview {
  const all = Object.values(getMockState().tasksByEvent).flat();
  const members: Record<string, { email: string; name: string; tasks: Task[] }> = {};
  all.forEach((t) => {
    const key = t.assigneeEmail || 'unassigned';
    if (!members[key]) {
      members[key] = {
        email: t.assigneeEmail,
        name: t.assigneeName || 'Unassigned',
        tasks: [],
      };
    }
    members[key].tasks.push(t);
  });

  return {
    members: Object.values(members),
    totalTasks: all.length,
    openTasks: all.filter((t) => t.status !== 'done').length,
  };
}

export function listMockActivity(eventCode: string | null): ActivityItem[] {
  return getActivityFor(eventCode);
}

export {
  getOrCreateMockVendorLink,
  regenerateMockVendorLink,
  listMockVendorLinks,
  revokeMockVendorLink,
} from './mockTemplates';
