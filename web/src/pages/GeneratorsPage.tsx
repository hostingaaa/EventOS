import { Link } from 'react-router-dom';
import './GeneratorsPage.css';

interface GeneratorCard {
  title:       string;
  description: string;
  detail:      string[];
  href:        string;
  icon:        string;
  color:       string;
  bg:          string;
  label:       string;
}

const GENERATORS: GeneratorCard[] = [
  {
    title: 'Transfer List Generator',
    description:
      'Build the airport ↔ hotel transfer list for any event. Add travelers, ' +
      'auto-groups flights, assigns vehicles by group size, and exports a ' +
      'fully styled .xlsx file.',
    detail: [
      'Groups travelers by flight automatically',
      'SEDAN · VAN · SPRINTER · MINIBUS · BUS — auto-assigned',
      'Merges cells for same-flight groups',
      'Black borders · Red title · Bold centered data',
      'Exports: {code}_{city}_{dates}_Transfer_List.xlsx',
    ],
    href:  '/transfer-list',
    icon:  '🚌',
    color: '#1d4ed8',
    bg:    '#eff6ff',
    label: 'Open Generator',
  },
  {
    title: 'AV Equipment List Generator',
    description:
      'Build the conference AV equipment list for any event. Select setup style, ' +
      'PAX, days, and configure each equipment item — exports a fully styled ' +
      '.xlsx file matching the PSA template.',
    detail: [
      'Classroom · Cabaret · Theatre · U-Shape · Boardroom setup styles',
      'LCD projector luminosity (3000–8000 lm) · Screen sizes',
      'Auto-calculates wireless mic totals (lapel + handheld)',
      'Simultaneous Interpretation: receivers & booth count',
      'Exports: {code}_{city}_{date}_Equipment.xlsx',
    ],
    href:  '/av-equipment',
    icon:  '🎛️',
    color: '#7c3aed',
    bg:    '#f5f3ff',
    label: 'Open Generator',
  },
  {
    title: 'Per Diem Form Generator',
    description:
      'Generate the PSA cash disbursement form for each traveler. Enter the ' +
      'M&IE daily rate, visa cap, and ground transport cap — prints a ' +
      'color-coded, signature-ready form.',
    detail: [
      'M&IE · Visa reimbursement · Ground transport sections',
      'Green = traveler · Blue = LEM signature areas',
      'Auto-calculates M&IE total (rate × days)',
      'Print-ready layout · Save as PDF',
      'IPS approval notes for overages',
    ],
    href:  '/per-diem-form',
    icon:  '📋',
    color: '#16a34a',
    bg:    '#f0fdf4',
    label: 'Open Generator',
  },
  {
    title: 'Service Report Generator',
    description:
      'Report the services provided for a program across 8 cost categories — ' +
      'Labor, Conference Equipment, Catering, Supplies, Printing, Photography, ' +
      'Transportation, Funds Distribution. Only pick the categories that applied, ' +
      'add each service with its amount and cost, and export a styled .xlsx.',
    detail: [
      'Check off only the categories a program actually used',
      'Per-category subtotals + grand total, computed live',
      'Saves to the event\'s Drive folder and syncs to Financials',
      'Admins/directors see a link right on the event page',
      'Exports: {code}_{city}_{date}_Service_Report.xlsx',
    ],
    href:  '/service-report',
    icon:  '🧾',
    color: '#b45309',
    bg:    '#fffbeb',
    label: 'Open Generator',
  },
  {
    title: 'QR Code Generator',
    description:
      'Turn a registration link (or any URL) into a scannable QR code — ' +
      'participants point their phone camera at it and the link opens ' +
      'straight in their browser.',
    detail: [
      'Paste any link, or pick an event to auto-fill a label',
      'Small / Medium / Large sizes, print-ready resolution',
      'Generated entirely in your browser — nothing sent to a third party',
      'Download as PNG or SVG',
    ],
    href:  '/qr-code',
    icon:  '▦',
    color: '#0f172a',
    bg:    '#f1f5f9',
    label: 'Open Generator',
  },
];

export function GeneratorsPage() {
  return (
    <div className="gen-page">
      <header className="gen-page__header">
        <h1>Generators</h1>
        <p>Operational document generators — build, preview, and export event documents in one click.</p>
      </header>

      <div className="gen-grid">
        {GENERATORS.map((g) => (
          <div key={g.href} className="gen-card" style={{ '--card-color': g.color, '--card-bg': g.bg } as React.CSSProperties}>
            <div className="gen-card__top">
              <span className="gen-card__icon">{g.icon}</span>
              <h2 className="gen-card__title">{g.title}</h2>
            </div>

            <p className="gen-card__desc">{g.description}</p>

            <ul className="gen-card__features">
              {g.detail.map((d) => (
                <li key={d}>
                  <span className="gen-card__check">✓</span>
                  {d}
                </li>
              ))}
            </ul>

            <Link to={g.href} className="gen-card__btn">
              {g.label} →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
