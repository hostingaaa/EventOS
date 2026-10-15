import { useState } from 'react';
import type { Comment } from '../../types';
import { addComment } from '../../api/client';
import { useUser } from '../../context/UserContext';
import { formatNoteTime } from '../../utils/activityText';

interface Props {
  /** Notes for this task (or, with no taskId, the event-wide ones), oldest first. */
  comments: Comment[];
  eventCode: string;
  taskId?: string;
  onAdded: (comment: Comment) => void;
  /** Right-aligned reminder of who can read these notes. */
  audience: string;
  /** Pre-notes-era admin-only text from the task's old "Internal notes" box, shown read-only to admins. */
  legacyInternalNote?: string;
  heading?: string;
  emptyText?: string;
}

/**
 * Notes on a task (or on the whole event): a list plus a composer. Admins can post a note as Internal —
 * admin-only and hidden from vendors; the backend enforces both rules, this only mirrors them.
 */
export function NotesPanel({
  comments,
  eventCode,
  taskId,
  onAdded,
  audience,
  legacyInternalNote,
  heading = 'Notes',
  emptyText = 'No notes yet — leave context for whoever picks this up.',
}: Props) {
  const { user, isAdmin } = useUser();
  const [draft, setDraft] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = comments.filter((c) => isAdmin || c.visibility !== 'internal');
  const legacy = isAdmin ? (legacyInternalNote ?? '').trim() : '';
  const count = visible.length + (legacy ? 1 : 0);
  const posting = internal && isAdmin;
  const cantPost = !draft.trim() || sending || !user;

  async function handlePost() {
    if (cantPost || !user) return;
    setSending(true);
    setError(null);
    try {
      const note = await addComment({
        eventCode,
        taskId,
        authorEmail: user.email,
        authorName: user.name,
        body: draft.trim(),
        visibility: posting ? 'internal' : 'team',
      });
      onAdded(note);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post the note');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="ws-notes">
      <div className="ws-notes__head">
        <h3>{heading}</h3>
        <span className={`ws-notes__count${count ? ' ws-notes__count--on' : ''}`}>{count}</span>
        <span className="ws-notes__audience">{audience}</span>
      </div>

      {legacy && (
        <article className="ws-note ws-note--internal">
          <div className="ws-note__meta">
            <span className="ws-note__avatar">i</span>
            <span className="ws-note__author">Earlier internal notes</span>
            <span className="ws-note__tag">Internal</span>
          </div>
          <p className="ws-note__body">{legacy}</p>
        </article>
      )}

      {visible.map((c) => {
        const name = c.authorName || c.authorEmail || 'Someone';
        const isInternal = c.visibility === 'internal';
        return (
          <article key={c.commentId} className={`ws-note${isInternal ? ' ws-note--internal' : ''}`}>
            <div className="ws-note__meta">
              <span className="ws-note__avatar">{name.charAt(0).toUpperCase()}</span>
              <span className="ws-note__author">{name}</span>
              <time className="ws-note__time">{formatNoteTime(c.createdAt)}</time>
              {isInternal && <span className="ws-note__tag">Internal</span>}
            </div>
            <p className="ws-note__body">{c.body}</p>
          </article>
        );
      })}

      {count === 0 && <p className="ws-notes__empty">{emptyText}</p>}

      {user ? (
        <div className={`ws-composer${posting ? ' ws-composer--internal' : ''}`}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={posting ? 'Internal note for admins…' : 'Write a note for the team…'}
            aria-label={posting ? 'Internal note' : 'Note'}
            rows={3}
            disabled={sending}
          />
          <div className="ws-composer__foot">
            {isAdmin && (
              <div className="ws-composer__toggle" role="group" aria-label="Who can see this note">
                <button type="button" className={!posting ? 'is-on' : ''} onClick={() => setInternal(false)}>
                  Team
                </button>
                <button type="button" className={posting ? 'is-on is-internal' : ''} onClick={() => setInternal(true)}>
                  Internal
                </button>
              </div>
            )}
            <span className="ws-composer__hint">{posting ? 'Admins only · hidden from vendors' : 'Visible to the team'}</span>
            <button
              type="button"
              className={`ws-composer__post${posting ? ' ws-composer__post--internal' : ''}`}
              onClick={handlePost}
              disabled={cantPost}
            >
              {sending ? 'Posting…' : 'Post'}
            </button>
          </div>
          {error && <p className="ws-composer__error">{error}</p>}
        </div>
      ) : (
        <p className="ws-notes__empty">Sign in to leave a note.</p>
      )}
    </section>
  );
}
