import type { MonthlyTrendPoint } from '../../utils/reportingAggregates';
import './MonthlyTrendChart.css';

interface Props {
  points: MonthlyTrendPoint[];
}

const WIDTH = 720;
const HEIGHT = 220;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;

function buildPath(values: number[], scaleY: (v: number) => number): string {
  const stepX = (WIDTH - PAD_LEFT - PAD_RIGHT) / Math.max(1, values.length - 1);
  return values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${PAD_LEFT + i * stepX} ${scaleY(v)}`)
    .join(' ');
}

/** Hand-rolled SVG line chart — no charting library needed for three simple series. */
export function MonthlyTrendChart({ points }: Props) {
  const allValues = points.flatMap((p) => [p.revenue, p.cost, p.profit]);
  const max = Math.max(1, ...allValues);
  const min = Math.min(0, ...allValues);
  const range = max - min || 1;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const scaleY = (v: number) => PAD_TOP + plotHeight - ((v - min) / range) * plotHeight;
  const zeroY = scaleY(0);

  const stepX = (WIDTH - PAD_LEFT - PAD_RIGHT) / Math.max(1, points.length - 1);

  const hasData = allValues.some((v) => v !== 0);

  return (
    <div className="trend-chart">
      <div className="trend-chart__legend">
        <span className="trend-chart__legend-item trend-chart__legend-item--revenue">Revenue</span>
        <span className="trend-chart__legend-item trend-chart__legend-item--cost">Cost</span>
        <span className="trend-chart__legend-item trend-chart__legend-item--profit">Profit</span>
      </div>
      {!hasData && <p className="trend-chart__empty">No revenue or cost data recorded for this year yet.</p>}
      {hasData && (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="trend-chart__svg" role="img" aria-label="Monthly revenue, cost and profit trend">
          <line x1={PAD_LEFT} y1={zeroY} x2={WIDTH - PAD_RIGHT} y2={zeroY} className="trend-chart__zero-line" />
          <path d={buildPath(points.map((p) => p.revenue), scaleY)} className="trend-chart__line trend-chart__line--revenue" />
          <path d={buildPath(points.map((p) => p.cost), scaleY)} className="trend-chart__line trend-chart__line--cost" />
          <path d={buildPath(points.map((p) => p.profit), scaleY)} className="trend-chart__line trend-chart__line--profit" />
          {points.map((p, i) => (
            <text key={p.month} x={PAD_LEFT + i * stepX} y={HEIGHT - 6} className="trend-chart__month-label" textAnchor="middle">
              {p.month}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
