import { STATUS } from "./tokens";
import "./charts.css";

const ICONS = { good: "✓", warning: "!", critical: "▲", info: "i" };

/**
 * One ratio against a limit, so a meter rather than a chart. The fill carries
 * severity, and the grade and its word sit beside it — the state is never
 * communicated by colour alone.
 */
export default function ScoreMeter({ score, grade, label, tone, caption }) {
  const colour = STATUS[tone] || STATUS.info;

  return (
    <div className="score-meter">
      <div className="score-meter__head">
        <div>
          <div className="hero-figure" style={{ color: colour }}>
            {score}
            <span className="score-meter__denom">/100</span>
          </div>
          <div className="score-meter__verdict" style={{ color: colour }}>
            <span className="score-meter__icon" aria-hidden="true">{ICONS[tone]}</span>
            Grade {grade} · {label}
          </div>
        </div>
      </div>

      <div
        className="meter-track"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Financial health score: ${score} out of 100, grade ${grade}, ${label}`}
      >
        <div className="meter-fill" style={{ width: `${score}%`, background: colour }} />
      </div>

      {caption ? <p className="score-meter__caption">{caption}</p> : null}
    </div>
  );
}
