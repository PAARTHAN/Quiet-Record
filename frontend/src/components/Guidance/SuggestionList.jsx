import { Link } from "react-router-dom";
import "./SuggestionList.css";

const TONE = {
  critical: { label: "Act now", icon: "▲" },
  warning: { label: "Attend to", icon: "!" },
  opportunity: { label: "Opportunity", icon: "↗" },
  good: { label: "On track", icon: "✓" },
  info: { label: "Housekeeping", icon: "i" },
};

/**
 * Guidance is state, so each item carries an icon and a written label as well
 * as its colour — never colour alone.
 */
export default function SuggestionList({ suggestions, limit, emptyText }) {
  const shown = limit ? suggestions.slice(0, limit) : suggestions;

  if (shown.length === 0) {
    return <div className="empty-state">{emptyText || "Nothing needs your attention."}</div>;
  }

  return (
    <ol className="suggestion-list">
      {shown.map((suggestion) => {
        const tone = TONE[suggestion.tone] || TONE.info;
        return (
          <li className={`suggestion tone-${suggestion.tone}`} key={suggestion.id}>
            <div className="suggestion__head">
              <span className="suggestion__flag">
                <span className="suggestion__icon" aria-hidden="true">{tone.icon}</span>
                {tone.label}
              </span>
              {suggestion.metric ? <span className="suggestion__metric">{suggestion.metric}</span> : null}
            </div>
            <h3>{suggestion.title}</h3>
            <p>{suggestion.detail}</p>
            {suggestion.action ? (
              <Link className="suggestion__action" to={suggestion.action.to}>
                {suggestion.action.label} →
              </Link>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
