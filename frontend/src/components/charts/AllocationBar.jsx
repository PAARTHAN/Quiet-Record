import { useState } from "react";
import { SERIES, SURFACE, MARK_GAP } from "./tokens";
import "./charts.css";

/**
 * Part-to-whole across asset classes: a horizontal stacked bar.
 * Segments are separated by 2px of surface; the outer ends are rounded by a
 * clip path so internal joins stay square. Every segment is direct-labelled
 * where it fits, and all of them are in the legend, so identity is never
 * carried by colour alone.
 */
export default function AllocationBar({ segments, total, height = 26, formatValue }) {
  const [hover, setHover] = useState(null);
  const visible = segments.filter((segment) => segment.value > 0);

  if (total <= 0 || visible.length === 0) {
    return <div className="chart-empty">Nothing recorded yet — add a holding to see your mix.</div>;
  }

  const width = 1000; // viewBox units; the SVG scales to its container
  const radius = height / 2;
  let cursor = 0;

  const laid = visible.map((segment, index) => {
    const raw = (segment.value / total) * width;
    const isLast = index === visible.length - 1;
    const gap = isLast ? 0 : MARK_GAP;
    const x = cursor;
    const w = Math.max(1, raw - gap);
    cursor += raw;
    return { ...segment, x, w, share: (segment.value / total) * 100 };
  });

  return (
    <div className="chart-shell allocation-shell">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Asset mix: ${laid.map((s) => `${s.label} ${s.share.toFixed(0)}%`).join(", ")}`}
        onMouseLeave={() => setHover(null)}
      >
        <clipPath id="alloc-round">
          <rect x="0" y="0" width={width} height={height} rx={radius} ry={radius} />
        </clipPath>
        <g clipPath="url(#alloc-round)">
          <rect x="0" y="0" width={width} height={height} fill={SURFACE} />
          {laid.map((segment) => (
            <rect
              key={segment.key}
              x={segment.x}
              y="0"
              width={segment.w}
              height={height}
              fill={SERIES[segment.key]}
              opacity={hover && hover.key !== segment.key ? 0.45 : 1}
              onMouseEnter={() => setHover(segment)}
            />
          ))}
        </g>
      </svg>

      {hover ? (
        <div
          className="chart-tooltip"
          style={{ left: `${((hover.x + hover.w / 2) / width) * 100}%` }}
        >
          <strong>{hover.label}</strong>
          <span className="tt-value">
            {formatValue(hover.value)} · {hover.share.toFixed(1)}%
          </span>
        </div>
      ) : null}

      <ul className="chart-legend allocation-legend">
        {laid.map((segment) => (
          <li className="legend-item" key={segment.key}>
            <span className="legend-swatch" style={{ background: SERIES[segment.key] }} />
            <span>{segment.label}</span>
            <span className="legend-value">
              {segment.share.toFixed(0)}% · {formatValue(segment.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
