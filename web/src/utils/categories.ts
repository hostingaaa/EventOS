/**
 * Canonical operational categories for the LEM event ops platform.
 * Each category has a short code, display label, colour token, and icon path.
 */
export interface OpsCategory {
  id: string;
  label: string;
  /** Tailwind-style hex used inline; also drives CSS custom-property injection */
  color: string;
  /** Lighter tint for backgrounds */
  bg: string;
  /** Short emoji / text icon shown in collapsed contexts */
  emoji: string;
  /** Colour of the small category dot on the event page; falls back to `color`. */
  dot?: string;
}

export const OPS_CATEGORIES: OpsCategory[] = [
  { id: 'AV',             label: 'AV & Technical',     color: '#7c3aed', bg: '#ede9fe', emoji: '🎛️', dot: '#7a5af5' },
  { id: 'Interpretation', label: 'Interpretation',      color: '#0369a1', bg: '#e0f2fe', emoji: '🌐' },
  { id: 'Venue',          label: 'Venue',               color: '#047857', bg: '#d1fae5', emoji: '🏛️', dot: '#2f9e5f' },
  { id: 'Catering',       label: 'Catering',            color: '#b45309', bg: '#fef3c7', emoji: '🍽️', dot: '#d9822b' },
  { id: 'Transportation', label: 'Transportation',      color: '#0d9488', bg: '#ccfbf1', emoji: '🚐' },
  { id: 'Registration',   label: 'Registration',        color: '#dc2626', bg: '#fee2e2', emoji: '📋' },
  { id: 'Printing',       label: 'Printing & Badges',  color: '#9333ea', bg: '#f3e8ff', emoji: '🖨️' },
  { id: 'Logistics',      label: 'Logistics',           color: '#64748b', bg: '#f1f5f9', emoji: '📦' },
  { id: 'Photography',    label: 'Photography',         color: '#db2777', bg: '#fce7f3', emoji: '📸' },
  { id: 'Travel',         label: 'Travel & Lodging',   color: '#0891b2', bg: '#cffafe', emoji: '✈️' },
  { id: 'Staffing',       label: 'Staffing',            color: '#16a34a', bg: '#dcfce7', emoji: '👥' },
  { id: 'LEM',            label: 'LEM / Coordination', color: '#ea580c', bg: '#ffedd5', emoji: '🎯', dot: '#e0552b' },
  { id: 'SOW',            label: 'SOW / Contracts',    color: '#6b7280', bg: '#f3f4f6', emoji: '📄', dot: '#767f83' },
  { id: 'Finance',        label: 'Finance',             color: '#0f766e', bg: '#ccfbf1', emoji: '💰' },
  { id: 'Legal',          label: 'Legal',               color: '#7c2d12', bg: '#fef2f2', emoji: '⚖️' },
  { id: 'General',        label: 'General',             color: '#475569', bg: '#f8fafc', emoji: '📌' },
];

/** Look up a category by its id (case-insensitive). Falls back to General. */
export function getCategory(id: string): OpsCategory {
  const norm = (id || '').trim();
  return (
    OPS_CATEGORIES.find((c) => c.id.toLowerCase() === norm.toLowerCase()) ||
    OPS_CATEGORIES.find((c) => c.id === 'General')!
  );
}

/** All category ids in display order */
export const CATEGORY_IDS = OPS_CATEGORIES.map((c) => c.id);

/** Category datalist values for <input list="..."> */
export const CATEGORY_LABELS = OPS_CATEGORIES.map((c) => c.label);
