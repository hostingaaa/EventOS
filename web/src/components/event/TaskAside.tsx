import React, { useMemo, useRef, useState } from 'react';
import type { Comment, Task, TaskFile } from '../../types';
import { deleteTaskFile, TASK_STATUSES, updateTask, uploadTaskFile } from '../../api/client';
import { useUser } from '../../context/UserContext';
import { actorName } from '../../utils/activityText';
import { appHref } from '../../utils/appHref';
import { getCategory } from '../../utils/categories';
import { formatIsoDate } from '../../utils/dateFormat';
import { getTransferListMeta } from '../../utils/transferListStore';
import { categoryDot } from '../../utils/taskView';
import { DateInput } from '../DateInput';
import { NotesPanel } from './NotesPanel';
import { STATUS_PILL } from './statusPill';

interface Props {
  task: Task | null;
  comments: Comment[];
  files: TaskFile[];
  onTaskUpdated: (task: Task) => void;
  onCommentAdded: (comment: Comment) => void;
  onFileAdded: (file: TaskFile) => void;
  onFileRemoved: (fileId: string) => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/** Pulls the /per-diem-form or /transfer-list link out of a template's rendered instructions. */
function linkFromInstructions(instructions: string, route: string): string {
  const match = instructions.match(new RegExp(`(${route}[^\\s\\n]*)`));
  return match ? match[1] : route;
}

/** Renders one instruction line, turning bare URLs and in-app paths into links. */
function renderInstructionLine(line: string): React.ReactNode {
  const urlRe = /(https?:\/\/[^\s]+|\/per-diem-form[^\s]*|\/transfer-list[^\s]*)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(line)) !== null) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    parts.push(
      <a key={m.index} href={appHref(m[0])} target="_blank" rel="noreferrer">
        {m[0]}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts.length ? parts : line;
}

/** Detail panel for the selected task: status, owner, due date, notes, instructions and files. */
export function TaskAside({ task, comments, files, onTaskUpdated, onCommentAdded, onFileAdded, onFileRemoved }: Props) {
  const { user, isAdmin } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const transferMeta = useMemo(
    () => (task?.templateId === 'tpl-transfer' && task.eventCode ? getTransferListMeta(task.eventCode) : null),
    [task?.templateId, task?.eventCode],
  );

  if (!task) {
    return (
      <aside className="ws-aside ws-aside--empty">
        <strong>Select a task</strong>
        <p>Pick any task on the left to see its notes, instructions and files, and to update its status.</p>
      </aside>
    );
  }

  const t = task;
  const cat = getCategory(t.category);
  const ownerLabel = t.assigneeName || t.assigneeEmail;
  const isAssignee = !!(user && t.assigneeEmail && t.assigneeEmail.toLowerCase() === user.email.toLowerCase());
  const canComplete = isAdmin || isAssignee;
  const canRemoveOwner = !!ownerLabel && (isAdmin || isAssignee);
  const sharedWithVendors = t.vendorVisible !== 'no';
  const taskComments = comments.filter((c) => c.taskId === t.taskId);
  const taskFiles = files.filter((f) => f.taskId === t.taskId);
  const instructionLines = (t.instructions || '').split('\n');

  async function save(updates: Parameters<typeof updateTask>[1]) {
    if (!user) return;
    setError(null);
    try {
      onTaskUpdated(await updateTask(t.taskId, updates, user.email));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the change');
    }
  }

  async function handleFiles(list: FileList | null) {
    if (!list?.length || !user) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(list)) {
        onFileAdded(await uploadTaskFile(t.taskId, t.eventCode, file, user.email));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleDeleteFile(fileId: string) {
    if (!user) return;
    setError(null);
    try {
      await deleteTaskFile(fileId, user.email);
      onFileRemoved(fileId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the file');
    }
  }

  return (
    <aside className="ws-aside">
      <div className="ws-aside__head">
        <div className="ws-aside__cat">
          <span className="ws-dot" style={{ background: categoryDot(cat) }} />
          <span className="ws-aside__cat-label">{cat.label}</span>
          {user && (
            <button
              type="button"
              className="ws-link-btn ws-aside__share"
              onClick={() => save({ vendorVisible: sharedWithVendors ? 'no' : 'yes' })}
              title={sharedWithVendors ? 'Visible on vendor portal links — click to hide it' : 'Hidden from vendors — click to share it'}
            >
              {sharedWithVendors ? 'Shared with vendors' : 'Share with vendor'}
            </button>
          )}
        </div>

        <h2 className="ws-aside__title">{t.title}</h2>

        {t.status === 'done' && t.completedBy && (
          <p className="ws-aside__note">
            ✓ Completed by <strong>{actorName(t.completedBy)}</strong>
            {t.completedAt && ` · ${formatIsoDate(t.completedAt.slice(0, 10))}`}
          </p>
        )}
        {user && !canComplete && t.status !== 'done' && (
          <p className="ws-aside__note ws-aside__note--lock">
            Only <strong>{t.assigneeName || 'the assignee'}</strong> or an admin can mark this task complete.
          </p>
        )}

        <div className="ws-seg" role="group" aria-label="Task status">
          {TASK_STATUSES.map((s) => {
            const on = t.status === s.value;
            const locked = s.value === 'done' && !canComplete;
            return (
              <button
                key={s.value}
                type="button"
                className={`ws-seg__opt${on ? ` ws-seg__opt--on ws-seg__opt--${STATUS_PILL[s.value].cls}` : ''}`}
                aria-pressed={on}
                disabled={!user || locked}
                title={locked ? 'Only the assignee or an admin can complete this task' : undefined}
                onClick={() => !on && save({ status: s.value })}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="ws-aside__fields">
          <div>
            <div className="ws-label">Owner</div>
            {ownerLabel ? (
              <div className="ws-owner">
                <span className="ws-avatar ws-avatar--lg">{ownerLabel.charAt(0).toUpperCase()}</span>
                <span className="ws-owner__name">{ownerLabel}</span>
                {canRemoveOwner && (
                  <button
                    type="button"
                    className="ws-owner__remove"
                    aria-label="Remove owner"
                    onClick={() => save({ assigneeEmail: '', assigneeName: '' })}
                  >
                    ✕
                  </button>
                )}
              </div>
            ) : (
              user && (
                <button
                  type="button"
                  className="ws-assign"
                  onClick={() => save({ assigneeEmail: user.email, assigneeName: user.name })}
                >
                  + Assign to me
                </button>
              )
            )}
          </div>
          <div>
            <div className="ws-label">Due date</div>
            <DateInput
              className="ws-date"
              value={t.dueDate || ''}
              disabled={!user}
              onChange={(iso) => {
                if (iso !== (t.dueDate || '')) void save({ dueDate: iso });
              }}
            />
          </div>
        </div>
        {error && <p className="ws-aside__error">{error}</p>}
      </div>

      <NotesPanel
        key={t.taskId}
        comments={taskComments}
        eventCode={t.eventCode}
        taskId={t.taskId}
        onAdded={onCommentAdded}
        audience="Shared with everyone on this event"
        legacyInternalNote={t.internalNotes}
      />

      <div className="ws-aside__section">
        <div className="ws-label">Instructions</div>

        {t.templateId === 'tpl-per-diem-form' && (
          <div className="ws-cta">
            <a className="ws-pill ws-pill--solid" href={appHref(linkFromInstructions(t.instructions, '/per-diem-form'))} target="_blank" rel="noreferrer">
              📋 Open Per Diem Form Generator
            </a>
            <span>Enter amounts → generate → print one form per traveler</span>
          </div>
        )}

        {t.templateId === 'tpl-transfer' &&
          (transferMeta ? (
            <div className="ws-cta">
              <strong>
                {transferMeta.travelerCount} traveler{transferMeta.travelerCount === 1 ? '' : 's'} saved
              </strong>
              <span>
                {transferMeta.savedBy ? `by ${actorName(transferMeta.savedBy)} · ` : ''}
                {new Date(transferMeta.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className="ws-cta__row">
                <a className="ws-pill ws-pill--solid" href={appHref(`/transfer-list?code=${encodeURIComponent(t.eventCode)}`)} target="_blank" rel="noreferrer">
                  ✏️ Update Transfer List
                </a>
                <a className="ws-pill ws-pill--outline" href={appHref(`/transfer-list?code=${encodeURIComponent(t.eventCode)}`)} target="_blank" rel="noreferrer">
                  📥 Export
                </a>
              </div>
            </div>
          ) : (
            <div className="ws-cta">
              <a className="ws-pill ws-pill--solid" href={appHref(linkFromInstructions(t.instructions, '/transfer-list'))} target="_blank" rel="noreferrer">
                🚌 Open Transfer List Generator
              </a>
              <span>Add travelers → save → export styled .xlsx</span>
            </div>
          ))}

        {t.instructions ? (
          <div className="ws-aside__instructions">
            {instructionLines.map((line, i) => (
              <p key={i}>{renderInstructionLine(line)}</p>
            ))}
          </div>
        ) : (
          <p className="ws-aside__muted">No instructions for this task.</p>
        )}
      </div>

      <div className="ws-aside__section">
        <div className="ws-files__head">
          <span className="ws-label">Files</span>
          {taskFiles.length > 0 && <span className="ws-files__count">{taskFiles.length}</span>}
          {user && (
            <button type="button" className="ws-link-btn ws-files__attach" onClick={() => fileInput.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading…' : '+ Attach'}
            </button>
          )}
        </div>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => void handleFiles(e.target.files)} />

        {taskFiles.map((f) => (
          <div key={f.fileId} className="ws-file">
            <span className="ws-file__ext">{(f.fileName.split('.').pop() || 'FILE').slice(0, 4).toUpperCase()}</span>
            <a className="ws-file__name" href={f.driveUrl} target="_blank" rel="noreferrer">
              {f.fileName}
            </a>
            <span className="ws-file__size">{formatSize(f.sizeBytes)}</span>
            {user && (
              <button type="button" className="ws-file__remove" aria-label={`Remove ${f.fileName}`} onClick={() => void handleDeleteFile(f.fileId)}>
                ✕
              </button>
            )}
          </div>
        ))}

        {taskFiles.length === 0 && (
          <button
            type="button"
            className="ws-dropzone"
            disabled={!user || uploading}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleFiles(e.dataTransfer.files);
            }}
          >
            Drop files or click to browse · PDF, Office, images up to 10 MB
          </button>
        )}
      </div>
    </aside>
  );
}
