import { useEffect, useRef, useState } from 'react';
import { useUser } from '../context/UserContext';
import {
  deleteOrgTemplateFile,
  fetchOrgTemplates,
  saveOrgTemplateFile,
  type OrgTemplateFile,
} from '../api/client';
import './OrgTemplatesPage.css';

const CATEGORIES = ['Print Materials', 'Social Media', 'Forms', 'Branding', 'Other'];

const FILE_TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word',
  doc: 'Word',
  xlsx: 'Excel',
  xls: 'Excel',
  other: 'File',
};

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: '#ef4444',
  docx: '#3b82f6',
  doc: '#3b82f6',
  xlsx: '#22c55e',
  xls: '#22c55e',
  other: '#94a3b8',
};

/** Embeddable preview URL — Drive's plain share link ("/view") refuses to be
 * framed, but "/preview" is designed for exactly this. Falls back to
 * whatever URL we have (e.g. a data: URL in demo/mock mode). */
function previewSrc(f: OrgTemplateFile): string | undefined {
  if (f.driveFileId) return `https://drive.google.com/file/d/${f.driveFileId}/preview`;
  return f.driveUrl;
}

/** A URL that actually streams the file instead of opening Drive's viewer. */
function downloadHref(f: OrgTemplateFile): string | undefined {
  if (f.driveFileId) return `https://drive.google.com/uc?export=download&id=${f.driveFileId}`;
  return f.driveUrl;
}

/** The normal Drive "view" link — safe to hand to anyone, since these files
 * are already shared org-wide with no login required. */
function shareUrl(f: OrgTemplateFile): string | undefined {
  if (f.driveUrl) return f.driveUrl;
  if (f.driveFileId) return `https://drive.google.com/file/d/${f.driveFileId}/view?usp=sharing`;
  return undefined;
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

/** Magnifying-glass-with-an-eye "preview" icon. Uses currentColor so it
 * picks up the button's own color (green, via .otf-btn--ghost). */
function PreviewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
      <line x1="15.8" y1="15.8" x2="21.5" y2="21.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M3.8 10 C6 6.8 8.2 5.4 10 5.4 C11.8 5.4 14 6.8 16.2 10 C14 13.2 11.8 14.6 10 14.6 C8.2 14.6 6 13.2 3.8 10 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.1" fill="currentColor" />
    </svg>
  );
}

/** Chain-link "copy shareable link" icon. Uses currentColor so it picks up
 * the button's own color (green, via .otf-btn--ghost). */
function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4.715 6.542 3.343 7.914a3 3 0 1 0 4.243 4.243l1.828-1.829A3 3 0 0 0 8.586 5.5L8 6.086a1 1 0 0 0-.154.199 2 2 0 0 1 .861 3.337L6.88 11.45a2 2 0 1 1-2.83-2.83l.793-.792a4 4 0 0 1-.128-1.287z" />
      <path d="M6.586 4.672A3 3 0 0 0 7.414 9.5l.775-.776a2 2 0 0 1-.896-3.346L9.12 3.55a2 2 0 1 1 2.83 2.83l-.793.792c.112.42.155.855.128 1.287l1.372-1.372a3 3 0 1 0-4.243-4.243L6.586 4.672Z" />
    </svg>
  );
}

/** Repeat/replace icon: two straight bars with chevron arrowheads
 * forming a loop. Uses currentColor so it picks up the button's own
 * color (green). */
function ReplaceIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

/** Folder-with-a-plus "add file" icon. Uses currentColor so it picks up
 * the button's own color (white, on otf-btn--primary's green fill). */
function AddFileIcon() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6.5a2 2 0 0 1 2-2h5.5l2.5 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="9.5" y1="13.5" x2="14.5" y2="13.5" />
    </svg>
  );
}

function FileTypeBadge({ type }: { type: string }) {
  return (
    <span
      className="otf-badge"
      style={{ background: FILE_TYPE_COLORS[type] ?? FILE_TYPE_COLORS.other }}
    >
      {FILE_TYPE_LABELS[type] ?? type.toUpperCase()}
    </span>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, string> = {
    'Print Materials': '🖨️',
    'Social Media': '📱',
    'Forms': '📋',
    'Branding': '🎨',
    'Other': '📎',
  };
  return <span>{icons[category] ?? '📄'}</span>;
}

interface PreviewModalProps {
  file: OrgTemplateFile;
  onClose: () => void;
}

function PreviewModal({ file, onClose }: PreviewModalProps) {
  const href = downloadHref(file);
  const src = previewSrc(file);
  const link = shareUrl(file);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!link) return;
    await copyToClipboard(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="otf-modal-overlay" onClick={onClose} role="presentation">
      <div className="otf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="otf-modal__header">
          <div className="otf-modal__title">
            <FileTypeBadge type={file.fileType} />
            <h2>{file.name}</h2>
          </div>
          <div className="otf-modal__actions">
            {link && (
              <button type="button" className="otf-btn otf-btn--secondary" onClick={handleCopy}>
                {copied ? '✓ Copied!' : '🔗 Copy link'}
              </button>
            )}
            {href && (
              <a className="otf-btn otf-btn--primary" href={href} target="_blank" rel="noopener noreferrer">
                ↓ Download
              </a>
            )}
            <button type="button" className="otf-modal__close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="otf-modal__body">
          {!src ? (
            <div className="otf-modal__no-preview">
              <span className="otf-modal__file-icon">📄</span>
              <p>File not uploaded yet.</p>
              <p className="otf-modal__hint">An admin can upload the file to enable preview and download.</p>
            </div>
          ) : (
            <iframe src={src} title={file.name} className="otf-modal__pdf-frame" />
          )}
        </div>
      </div>
    </div>
  );
}

export function OrgTemplatesPage() {
  const { user, isAdmin } = useUser();
  const [files, setFiles] = useState<OrgTemplateFile[]>([]);
  const [preview, setPreview] = useState<OrgTemplateFile | null>(null);
  const [addModal, setAddModal] = useState(false);
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const addFileInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      setFiles(await fetchOrgTemplates());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAddFile(fileList: FileList | null) {
    if (!fileList?.length || !user) return;
    setUploading('new');
    setError(null);
    try {
      for (const f of Array.from(fileList)) {
        await saveOrgTemplateFile({ name: f.name.replace(/\.[^.]+$/, ''), category: newCategory, file: f, actorEmail: user.email });
      }
      await refresh();
      setAddModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  }

  async function handleUploadToExisting(id: string, fileList: FileList | null) {
    if (!fileList?.length || !user) return;
    setUploading(id);
    setError(null);
    try {
      await saveOrgTemplateFile({ id, file: fileList[0], actorEmail: user.email });
      await refresh();
      if (preview?.id === id) {
        setPreview((await fetchOrgTemplates()).find((f) => f.id === id) ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  }

  async function handleCopyLink(f: OrgTemplateFile) {
    const link = shareUrl(f);
    if (!link) return;
    await copyToClipboard(link);
    setCopiedId(f.id);
    setTimeout(() => setCopiedId((cur) => (cur === f.id ? null : cur)), 2000);
  }

  async function handleDelete(id: string, name: string) {
    if (!user || !confirm(`Remove "${name}" from the template library?`)) return;
    try {
      await deleteOrgTemplateFile(id, user.email);
      await refresh();
      if (preview?.id === id) setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove template');
    }
  }

  const grouped = CATEGORIES.reduce<Record<string, OrgTemplateFile[]>>(
    (acc, cat) => {
      acc[cat] = files.filter((f) => f.category === cat);
      return acc;
    },
    {},
  );
  const otherFiles = files.filter((f) => !CATEGORIES.includes(f.category));
  if (otherFiles.length) {
    grouped['Other'] = [...(grouped['Other'] ?? []), ...otherFiles];
  }

  return (
    <div className="otf-page">
      <header className="otf-page__header">
        <div>
          <h1>Templates</h1>
          <p>Branded and operational template files for the team — print materials, social media assets, and forms.</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="otf-btn otf-btn--primary otf-btn--icon-lg"
            onClick={() => setAddModal(true)}
            title="Add file"
            aria-label="Add file"
          >
            <AddFileIcon />
          </button>
        )}
      </header>

      {error && <p className="otf-error">{error}</p>}

      {CATEGORIES.map((cat) => {
        const catFiles = grouped[cat] ?? [];
        if (!catFiles.length) return null;
        return (
          <section key={cat} className="otf-section">
            <h2 className="otf-section__title">
              <CategoryIcon category={cat} /> {cat}
              <span className="otf-section__count">{catFiles.length}</span>
            </h2>
            <div className="otf-grid">
              {catFiles.map((f) => {
                const hasFile = Boolean(f.driveUrl);
                return (
                  <article key={f.id} className={`otf-card${hasFile ? '' : ' otf-card--pending'}`}>
                    <div className="otf-card__top">
                      <div className="otf-card__thumb" onClick={() => setPreview(f)}>
                        {hasFile && f.fileType === 'pdf' ? (
                          <iframe
                            src={previewSrc(f)}
                            title={f.name}
                            className="otf-card__thumb-frame"
                            tabIndex={-1}
                          />
                        ) : (
                          <span className="otf-card__thumb-icon">
                            {f.fileType === 'pdf' ? '📄'
                              : f.fileType === 'docx' || f.fileType === 'doc' ? '📝'
                              : f.fileType === 'xlsx' || f.fileType === 'xls' ? '📊'
                              : '📎'}
                          </span>
                        )}
                        <div className="otf-card__thumb-overlay">
                          <span>
                            {hasFile
                              ? '👁 Preview'
                              : isAdmin
                                ? '📤 Upload'
                                : '📄 View'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="otf-card__body">
                      <FileTypeBadge type={f.fileType} />
                      <h3 className="otf-card__name" title={f.name}>{f.name}</h3>
                      {!hasFile && isAdmin && (
                        <p className="otf-card__status">File not uploaded yet</p>
                      )}
                      {!hasFile && !isAdmin && (
                        <p className="otf-card__status otf-card__status--muted">Coming soon</p>
                      )}
                      {f.addedAt && (
                        <p className="otf-card__meta">
                          {f.addedBy} · {new Date(f.addedAt).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>

                    <div className="otf-card__footer">
                      <button
                        type="button"
                        className="otf-btn otf-btn--sm otf-btn--icon otf-btn--ghost"
                        onClick={() => setPreview(f)}
                        disabled={uploading === f.id}
                        title={hasFile ? 'Preview' : 'View'}
                        aria-label={hasFile ? 'Preview' : 'View'}
                      >
                        <PreviewIcon />
                      </button>

                      {hasFile && (
                        <button
                          type="button"
                          className="otf-btn otf-btn--sm otf-btn--icon otf-btn--ghost"
                          onClick={() => handleCopyLink(f)}
                          title={copiedId === f.id ? 'Copied!' : 'Copy a shareable link to this file'}
                          aria-label="Copy shareable link"
                        >
                          {copiedId === f.id ? '✓' : <LinkIcon />}
                        </button>
                      )}

                      {isAdmin && (
                        <>
                          <label
                            className={`otf-btn otf-btn--sm otf-btn--icon otf-btn--ghost${uploading === f.id ? ' loading' : ''}`}
                            title={hasFile ? 'Replace file' : 'Upload file'}
                            aria-label={hasFile ? 'Replace file' : 'Upload file'}
                          >
                            {uploading === f.id ? '…' : <ReplaceIcon />}
                            <input
                              type="file"
                              hidden
                              accept=".pdf,.docx,.doc,.xlsx,.xls"
                              onChange={(e) => handleUploadToExisting(f.id, e.target.files)}
                            />
                          </label>
                          <button
                            type="button"
                            className="otf-btn otf-btn--sm otf-btn--danger"
                            onClick={() => handleDelete(f.id, f.name)}
                            title="Remove from library"
                          >
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {files.length === 0 && (
        <div className="otf-empty">
          <p>No template files yet.</p>
          {isAdmin && <p>Click the folder icon above to upload the first one.</p>}
        </div>
      )}

      {/* Preview modal */}
      {preview && <PreviewModal file={preview} onClose={() => setPreview(null)} />}

      {/* Add new file modal (admin) */}
      {addModal && isAdmin && (
        <div className="otf-modal-overlay" onClick={() => setAddModal(false)} role="presentation">
          <div className="otf-modal otf-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="otf-modal__header">
              <h2>Add template file</h2>
              <button type="button" className="otf-modal__close" onClick={() => setAddModal(false)}>✕</button>
            </div>
            <div className="otf-modal__form">
              <label>
                Category
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <div
                className={`otf-dropzone${dragOver ? ' drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleAddFile(e.dataTransfer.files);
                }}
                onClick={() => addFileInput.current?.click()}
              >
                <span>📤</span>
                <p>Drop file here or click to browse</p>
                <small>PDF, Word, or Excel</small>
                <input
                  ref={addFileInput}
                  type="file"
                  hidden
                  multiple
                  accept=".pdf,.docx,.doc,.xlsx,.xls"
                  onChange={(e) => handleAddFile(e.target.files)}
                />
              </div>
              {uploading === 'new' && <p className="otf-uploading">Uploading…</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
