import { useState } from 'react';
import { createTask } from '../../api/client';
import type { Task } from '../../types';
import { OPS_CATEGORIES } from '../../utils/categories';
import '../NewProjectModal.css';

interface Props {
  eventCode: string;
  eventRowId: string;
  actorEmail: string;
  /** Category preselected in the dropdown (e.g. the selected task's). */
  defaultCategory?: string;
  onCreated: (task: Task) => void;
  onClose: () => void;
}

export function AddTaskModal({ eventCode, eventRowId, actorEmail, defaultCategory = 'General', onCreated, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const task = await createTask({ eventCode, eventRowId, title: title.trim(), category, createdBy: actorEmail });
      onCreated(task);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the task');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <form className="modal-card new-project" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <header>
          <h2>Add a task to {eventCode}</h2>
          <p>Tasks start unassigned and open. Add instructions, an owner and a due date from the task panel.</p>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="new-project__body">
          <div className="new-project__grid">
            <label className="new-project__full">
              Task
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Confirm airport pickup times" autoFocus />
            </label>
            <label className="new-project__full">
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {OPS_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error && <p className="new-project__err">{error}</p>}

        <footer>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !title.trim()}>
            {saving ? 'Adding…' : 'Add task'}
          </button>
        </footer>
      </form>
    </div>
  );
}
