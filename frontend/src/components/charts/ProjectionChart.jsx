import { useRef, useState } from "react";
import { GRID, AXIS_TEXT, SERIES, SURFACE } from "./tokens";
import "./charts.css";

/**
 * Projected corpus over time against the corpus retirement actually needs.
 * One series, so no legend box — the caption names it — and the requirement is
 * a labelled baseline rule rather than a second axis.
 */
/** Round a raw axis step up to a 1 / 2 / 5 × 10ⁿ value so ticks read cleanly. */
function niceStep(raw) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const normalized = raw / magnitude;
  const stepped = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return stepped * magnitude;
}

export default function ProjectionChart({ points, required, formatCompact, formatValue, height = 220 }) {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);

  const width = 720;
  const pad = { top: 18, right: 16, bottom: 28, left: 58 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const rawMax = Math.max(required, ...points.map((point) => point.value)) * 1.08 || 1;
  const step = niceStep(rawMax / 4);
  const maxValue = Math.ceil(rawMax / step) * step;
  const lastYear = points[points.length - 1].year || 1;

  const xOf = (year) => pad.left + (year / lastYear) * plotW;
  const yOf = (value) => pad.top + plotH - (value / maxValue) * plotH;

  const line = points.map((point) => `${xOf(point.year)},${yOf(point.value)}`).join(" ");
  const area = `${pad.left},${pad.top + plotH} ${line} ${xOf(lastYear)},${pad.top + plotH}`;

  const ticks = [];
  for (let value = 0; value <= maxValue + 1; value += step) ticks.push(value);

  // Always keep the first and last age; drop any interval tick that would
  // collide with the last label rather than letting the two overprint.
  const interval = Math.max(5, Math.round(lastYear / 5));
  const yearTicks = points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) return true;
    return point.year % interval === 0 && lastYear - point.year >= interval / 2;
  });

  function handleMove(event) {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    const ratio = (event.clientX - box.left) / box.width;
    const year = Math.round(ratio * width < pad.left ? 0 : ((ratio * width - pad.left) / plotW) * lastYear);
    const point = points[Math.min(points.length - 1, Math.max(0, year))];
    if (point) setHover(point);
  }

  return (
    <div className="chart-shell" ref={wrapRef} onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="projection-svg"
        role="img"
        aria-label={`Projected corpus growing from ${formatValue(points[0].value)} today to ${formatValue(points[points.length - 1].value)} at age ${points[points.length - 1].age}, against a requirement of ${formatValue(required)}.`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={yOf(tick)} y2={yOf(tick)} stroke={GRID} strokeWidth="1" />
            <text x={pad.left - 8} y={yOf(tick) + 4} textAnchor="end" fontSize="10" fill={AXIS_TEXT}>
              {formatCompact(tick)}
            </text>
          </g>
        ))}

        <polygon points={area} fill={SERIES.equity} opacity="0.1" />
        <polyline points={line} fill="none" stroke={SERIES.equity} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* What retirement actually needs — a labelled baseline, not a second scale. */}
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={yOf(required)}
          y2={yOf(required)}
          stroke={SERIES.cash}
          strokeWidth="2"
        />
        <text x={width - pad.right} y={yOf(required) - 6} textAnchor="end" fontSize="10" fontWeight="600" fill={SERIES.cash}>
          Needed: {formatCompact(required)}
        </text>

        {yearTicks.map((point) => (
          <text key={point.year} x={xOf(point.year)} y={height - 8} textAnchor="middle" fontSize="10" fill={AXIS_TEXT}>
            age {point.age}
          </text>
        ))}

        {hover ? (
          <g>
            <line x1={xOf(hover.year)} x2={xOf(hover.year)} y1={pad.top} y2={pad.top + plotH} stroke={AXIS_TEXT} strokeWidth="1" opacity="0.5" />
            <circle cx={xOf(hover.year)} cy={yOf(hover.value)} r="5" fill={SERIES.equity} stroke={SURFACE} strokeWidth="2" />
          </g>
        ) : null}
      </svg>

      {hover ? (
        <div
          className={`chart-tooltip ${yOf(hover.value) < pad.top + plotH * 0.28 ? "is-below" : ""}`}
          style={{ left: `${(xOf(hover.year) / width) * 100}%`, top: `${(yOf(hover.value) / height) * 100}%` }}
        >
          <strong>Age {hover.age}</strong>
          <span className="tt-value">{formatValue(hover.value)}</span>
        </div>
      ) : null}
    </div>
  );
}
