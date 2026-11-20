import type { GeneratorId } from '../../utils/generatorStatus';

/** Line icons from the Generators design handoff (24×24, stroked in currentColor). */
export function GeneratorIcon({ id }: { id: GeneratorId }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {id === 'transfer' && (
        <>
          <path d="M3 6h11.5l4 5H21v5.5h-2" />
          <path d="M3 6v10.5h2.2" />
          <path d="M14 6v5h4.5" />
          <circle cx="7.5" cy="16.8" r="1.9" />
          <circle cx="16.5" cy="16.8" r="1.9" />
          <path d="M9.6 16.5h4.8" />
        </>
      )}
      {id === 'av' && (
        <>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
          <path d="M10 8.5v3l3-1.5z" />
        </>
      )}
      {id === 'supplies' && (
        <>
          <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
          <path d="M3 7.5 12 12l9-4.5M12 12v9" />
          <path d="m7.5 5.2 9 4.6" />
        </>
      )}
      {id === 'perdiem' && (
        <>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </>
      )}
      {id === 'service' && (
        <>
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4V3h6v1" />
          <path d="M9 17v-3M12 17v-7M15 17v-5" />
        </>
      )}
      {id === 'qr' && (
        <>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 20h2M20 14v2" />
        </>
      )}
    </svg>
  );
}
