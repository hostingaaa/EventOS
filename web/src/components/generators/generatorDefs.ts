/** Generator cards on the Generators page — titles, copy, colours and formats from the design handoff. */
import type { GeneratorId } from '../../utils/generatorStatus';

export interface GeneratorDef {
  id: GeneratorId;
  title: string;
  category: string;
  format: string;
  description: string;
  tags: string;
  color: string;
  tint: string;
  border: string;
  /** Utility rather than an event document: not counted in progress, no status. */
  tool?: boolean;
}

export const GENERATORS: GeneratorDef[] = [
  {
    id: 'transfer', title: 'Transfer List', category: 'Logistics', format: 'XLSX',
    color: '#2557c9', tint: '#eef3fd', border: '#d3def7',
    description: 'Airport ↔ hotel transfers for every traveler. Flights are grouped automatically and each group gets the right vehicle.',
    tags: 'Flight grouping · Sedan → Bus auto-assigned · Merged same-flight rows',
  },
  {
    id: 'av', title: 'AV Equipment List', category: 'Equipment', format: 'XLSX',
    color: '#6b3fc4', tint: '#f3effc', border: '#e0d6f6',
    description: 'The conference AV list from setup style, PAX and days — projectors, screens, mics and interpretation, on the PSA template.',
    tags: '5 setup styles · 3000–8000 lm · Mic totals · SI receivers & booths',
  },
  {
    id: 'supplies', title: 'Supplies & Materials', category: 'Materials', format: 'XLSX',
    color: '#9a5807', tint: '#fdf5e8', border: '#f3e1c2',
    description: 'Briefing folders, table tents, notepads, name badges or your own items, with amounts, on the PSA template.',
    tags: 'Common items or your own · Listed as 1 day · Syncs to Financials',
  },
  {
    id: 'perdiem', title: 'Per Diem Form', category: 'Finance', format: 'PDF',
    color: '#1d7a4a', tint: '#eef8f2', border: '#d2ecdd',
    description: 'The PSA cash disbursement form for each traveler, from the M&IE rate, visa cap and ground transport cap.',
    tags: 'M&IE = rate × days · LEM signature areas · IPS overage notes',
  },
  {
    id: 'service', title: 'Service Report', category: 'Reporting', format: 'XLSX',
    color: '#b0304f', tint: '#fcf0f3', border: '#f3d5dd',
    description: 'Services provided across 8 cost categories. Tick only the ones used, add each service with amount and cost.',
    tags: 'Live subtotals + grand total · Syncs to Financials · Linked on event page',
  },
  {
    id: 'qr', title: 'QR Code', category: 'Utility', format: 'PNG · SVG', tool: true,
    color: '#3d464a', tint: '#f4f7f7', border: '#e0e6e8',
    description: 'Turn a registration link, or any URL, into a QR code participants scan to open it in their browser.',
    tags: 'S / M / L print sizes · Made in your browser, nothing sent out',
  },
];
