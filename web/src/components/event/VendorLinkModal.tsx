import { useState } from 'react';
import type { VendorLinkOptions } from '../../api/client';
import { categoryLabel } from '../../utils/taskView';
import '../NewProjectModal.css';

interface Props {
  eventCode: string;
  /** Categories that have tasks on this event. */
  categories: string[];
  /** Categories that already have an active link (a category can only have one). */
  usedCategories: Set<string>;
  initialCategory?: string;
  onCreate: (options: VendorLinkOptions) => Promise<unknown>;
  onClose: () => void;
}

export function VendorLinkModal({ eventCode, categories, usedCategories, initialCategory = '', onCreate, onClose }: Props) {
  const [vendorName, setVendorName] = useState('');
  const [vendorCategory, setVendorCategory] = useState(
    initialCategory && !usedCategories.has(initialCategory) ? initialCategory : '',
  );
  const [permission, setPermission] = useState<'view' | 'collaborate'>('view');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await onCreate({
        vendorCategory: vendorCategory || undefined,
        vendorName: vendorName.trim() || undefined,
        permission,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the vendor link. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <form className="modal-card new-project" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <header>
          <h2>New vendor link for {eventCode}</h2>
          <p>Vendors only see the tasks and files in the scope you choose — never anything else on {eventCode}.</p>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="new-project__body">
          <div className="new-project__grid">
            <label className="new-project__full">
              Vendor name (optional)
              <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="e.g. ACME Audio" autoFocus />
            </label>
            <label className="new-project__full">
              Category scope
              <select value={vendorCategory} onChange={(e) => setVendorCategory(e.target.value)}>
                <option value="">Full event (all tasks)</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat} disabled={usedCategories.has(cat)}>
                    {categoryLabel(cat)}
                    {usedCategories.has(cat) ? ' · already linked' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="new-project__full">
              Permission
              <select value={permission} onChange={(e) => setPermission(e.target.value as 'view' | 'collaborate')}>
                <option value="view">View only (read-only)</option>
                <option value="collaborate">Collaborator (submit rates, upload files, mark complete)</option>
              </select>
            </label>
          </div>
        </div>

        {error && <p className="new-project__err">{error}</p>}

        <footer>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create link'}
          </button>
        </footer>
      </form>
    </div>
  );
}
