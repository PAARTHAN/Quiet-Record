import { SERIES, GRID, AXIS_TEXT } from "./tokens";
import "./charts.css";

/**
 * Distance from the target mix: a diverging bar per asset class, centred on
 * the target. Left of the line is underweight, right is overweight — polarity
 * is the job, so the baseline does the work and the class keeps its own hue.
 */
export default function DriftBars({ rows, formatValue }) {
  const widest = Math.max(8, ...rows.map((row) => Math.abs(row.drift)));

  return (
    <div className="drift-chart">
      {rows.map((row) => {
        const magnitude = Math.min(50, (Math.abs(row.drift) / widest) * 50);
        const under = row.drift < 0;
        const onTarget = Math.abs(row.drift) < 1;

        return (
          <div className="drift-row" key={row.key}>
            <div className="drift-label">
              <span className="legend-swatch" style={{ background: SERIES[row.key] }} />
              {row.label}
            </div>

            <div className="drift-track" style={{ "--grid": GRID }}>
              <span className="drift-baseline" />
              {!onTarget && (
                <span
                  className="drift-bar"
                  style={{
                    background: SERIES[row.key],
                    width: `${magnitude}%`,
                    left: under ? `${50 - magnitude}%` : "50%",
                    borderRadius: under ? "4px 0 0 4px" : "0 4px 4px 0",
                  }}
                />
              )}
            </div>

            <div className="drift-values">
              <span className="drift-delta" style={{ color: AXIS_TEXT }}>
                {onTarget ? "on target" : `${under ? "−" : "+"}${Math.abs(row.drift).toFixed(0)} pts`}
              </span>
              <span className="drift-amount">
                {row.actual.toFixed(0)}% held · {row.target}% target
                {onTarget ? "" : ` · ${formatValue(Math.abs(row.amount))} ${under ? "short" : "over"}`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
