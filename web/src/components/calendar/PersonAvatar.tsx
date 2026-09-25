import type { CSSProperties } from 'react';
import { getPersonColor } from '../../utils/personColors';

interface Props {
  email: string;
  name?: string;
  size?: number;
  /** 'solid' = filled with the person's solid color + white text (leads,
   * single avatars). 'tint' = the person's light tint bg + tint text
   * (support rows in the People timeline). */
  variant?: 'solid' | 'tint';
  style?: CSSProperties;
  title?: string;
}

/** Small colored initials circle — the one shared building block for a
 * person's identity across the Calendar page's chips, timeline rows, aside
 * cards, and the EventDetail team picker, so the same person always reads
 * the same color everywhere. */
export function PersonAvatar({ email, name, size = 28, variant = 'solid', style, title }: Props) {
  const color = getPersonColor(email || name || '?');
  const initial = (name || email || '?').trim().charAt(0).toUpperCase();
  const bg = variant === 'solid' ? color.solid : color.tintBg;
  const fg = variant === 'solid' ? '#ffffff' : color.tintText;

  return (
    <span
      className="person-avatar"
      title={title ?? name ?? email}
      style={{
        width: size,
        height: size,
        minWidth: size,
        flexShrink: 0,
        borderRadius: 999,
        display: 'grid',
        placeItems: 'center',
        fontFamily: "'Archivo', inherit",
        fontWeight: 800,
        fontSize: Math.round(size * 0.42),
        background: bg,
        color: fg,
        ...style,
      }}
    >
      {initial}
    </span>
  );
}
