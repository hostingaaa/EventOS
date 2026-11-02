import type { ReactNode } from 'react';

/** "COMPANY FINANCIALS ———— caption": the uppercase section label with a rule filling the row. */
export function ReportSection({ title, caption }: { title: string; caption?: ReactNode }) {
  return (
    <div className="rp-section">
      <h2 className="rp-section__title">{title}</h2>
      <span className="rp-section__rule" />
      {caption && <span className="rp-section__caption">{caption}</span>}
    </div>
  );
}
