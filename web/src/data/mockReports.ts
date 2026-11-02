import type { ReportData, ReportRow } from '../types';

/** Demo data for mock mode: the Reports design's sample events, placed in whatever year is asked for. */
const SAMPLE: [string, number, string, string, string, number, number, number][] = [
  ['J101', 0, 'Almaty', 'Kazakhstan', 'm.iskakova', 62000, 41000, 1],
  ['J118', 1, 'Tashkent', 'Uzbekistan', 'n.rahimov', 78000, 52500, 1],
  ['J124', 1, 'Bishkek', 'Kyrgyzstan', 'translations', 41000, 30200, 1],
  ['J139', 2, 'Ulaanbaatar', 'Mongolia', 'admin', 55000, 39800, 1],
  ['J147', 3, 'Dushanbe', 'Tajikistan', 'admin', 36000, 28900, 1],
  ['J155', 3, 'Tashkent', 'Uzbekistan', 'n.rahimov', 92000, 58400, 1],
  ['J168', 4, 'Astana', 'Kazakhstan', 'm.iskakova', 70500, 47100, 1],
  ['J176', 5, 'Ashgabat', 'Turkmenistan', 'translations', 48000, 35600, 1],
  ['J189', 5, 'Samarkand', 'Uzbekistan', 'n.rahimov', 66000, 42300, 1],
  ['J203', 6, 'Almaty', 'Kazakhstan', 'm.iskakova', 84000, 55900, 1],
  ['J221', 7, 'Bishkek', 'Kyrgyzstan', 'translations', 39500, 31700, 1],
  ['J240', 7, 'Tashkent', 'Uzbekistan', 'n.rahimov', 101000, 63800, 0],
  ['J506', 8, 'Ashgabat', 'Turkmenistan', 'translations', 58000, 41200, 0],
  ['J351', 8, 'Dushanbe', 'Tajikistan', 'admin', 44000, 36900, 1],
  ['J334', 8, 'Ulaanbaatar', 'Mongolia', 'admin', 61000, 43500, 0],
  ['J362', 9, 'Bishkek', 'Kyrgyzstan', 'translations', 47000, 33100, 0],
  ['J377', 9, 'Tashkent', 'Uzbekistan', 'n.rahimov', 88000, 57200, 0],
  ['J388', 10, 'Almaty', 'Kazakhstan', 'm.iskakova', 73000, 49800, 0],
  ['J395', 10, 'Tashkent', 'Uzbekistan', 'n.rahimov', 69000, 45000, 0],
  ['J402', 11, 'Astana', 'Kazakhstan', 'm.iskakova', 81000, 54000, 0],
];

const TARGET_KEY = 'mock_report_monthly_target';

export function getMockReportData(year: number): ReportData {
  const rows: ReportRow[] = SAMPLE.map(([code, m, city, country, owner, revenue, cost, paid]) => {
    const mm = String(m + 1).padStart(2, '0');
    return {
      code,
      location: `${city}, ${country}`,
      startDate: `${year}-${mm}-10`,
      endDate: `${year}-${mm}-12`,
      ownerEmail: `${owner}@demo.test`,
      status: 'Completed',
      revenue,
      cost,
      costByCategory: {
        Venue: Math.round(cost * 0.34),
        Interpretation: Math.round(cost * 0.22),
        Travel: Math.round(cost * 0.18),
        'AV & tech': Math.round(cost * 0.14),
        Catering: Math.round(cost * 0.12),
      },
      paid: !!paid,
    };
  });
  let target = 112000;
  try {
    const saved = localStorage.getItem(TARGET_KEY);
    if (saved !== null) target = Number(saved) || 0;
  } catch { /* storage unavailable */ }
  return { year, years: [year], rows, monthlyTarget: target, unconvertedCurrencies: [] };
}

export function saveMockReportTarget(target: number): number {
  const n = Math.max(0, Math.round(target) || 0);
  try {
    localStorage.setItem(TARGET_KEY, String(n));
  } catch { /* storage unavailable */ }
  return n;
}
