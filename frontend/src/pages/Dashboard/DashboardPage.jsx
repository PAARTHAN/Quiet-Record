import { Link } from "react-router-dom";
import SectionHeader from "../../components/SectionHeader/SectionHeader";
import SuggestionList from "../../components/Guidance/SuggestionList";
import AllocationBar from "../../components/charts/AllocationBar";
import { allocationSegments, buildAdvice } from "../../advisor";
import { formatCurrency, formatDuration } from "../../storage";
import "./DashboardPage.css";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage({ user, records, contacts, triggerStatus, financialProfile }) {
  const advice = buildAdvice({
    records, contacts, user, triggerStatus,
    profile: financialProfile,
    currency: formatCurrency,
  });

  const { portfolio, health, profile, suggestions } = advice;
  const firstName = (user.name || "").trim().split(" ")[0] || "there";

  const expired = triggerStatus?.is_timer_active
    && !triggerStatus?.is_triggered
    && triggerStatus?.seconds_until_trigger <= 0;

  const countdown = triggerStatus?.is_triggered
    ? "Sent"
    : expired
      ? "Time up"
      : !triggerStatus?.is_timer_active
        ? "Off"
        : triggerStatus?.seconds_until_trigger !== undefined
          ? formatDuration(triggerStatus.seconds_until_trigger)
          : "—";

  return (
    <>
      <SectionHeader
        title={`${greeting()}, ${firstName}`}
        description="Here is where your money stands today, and the one thing most worth doing about it."
      />

      {!profile.isComplete ? (
        <div className="notice warning dash-prompt">
          <div>
            <strong>Two numbers would make this much more useful.</strong> Tell us what you earn and what
            you spend each month, and we can say how much to save and whether you will have enough later.
          </div>
          <Link className="btn gold" to="/advisor">Add them</Link>
        </div>
      ) : null}

      <div className="dash-top">
        <div className="card card-ledger dash-worth">
          <span className="eyebrow">Everything you own, less everything you owe</span>
          <div className={`hero-figure ${portfolio.netWorth < 0 ? "is-negative" : ""}`}>
            {formatCurrency(portfolio.netWorth)}
          </div>
          <p className="muted">That is what you are worth today, across {records.length} thing{records.length === 1 ? "" : "s"} you have listed.</p>

          <div className="worth-split">
            <div>
              <span>You own</span>
              <strong>{formatCurrency(portfolio.assets)}</strong>
            </div>
            <div>
              <span>You owe</span>
              <strong className="is-owed">{formatCurrency(portfolio.liabilities)}</strong>
            </div>
            <div>
              <span>Cash you can use now</span>
              <strong>{formatCurrency(portfolio.totals.cash)}</strong>
            </div>
          </div>
        </div>

        <div className="card dash-health">
          <h2>How you are doing</h2>
          <div className={`health-word tone-${health.tone}`}>{health.grade}</div>
          <p className="muted">{health.label}.</p>
          <div className="meter-track dash-health__meter">
            <div className={`meter-fill tone-${health.tone}`} style={{ width: `${health.score}%` }} />
          </div>
          <p className="muted small">
            We look at five things: emergency money, what you owe, how much you keep,
            whether your money is spread out, and whether anyone could find it.
          </p>
          <Link className="btn dash-health__cta" to="/advisor">See what to do</Link>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Where your money is</h2>
            <p>Everything you own, by the kind of thing it is.</p>
          </div>
        </div>
        <AllocationBar segments={allocationSegments(portfolio)} total={portfolio.assets} formatValue={formatCurrency} />
      </div>

      <div className="split-main">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>What to do next</h2>
              <p>Most important first. All of it worked out from what you have listed.</p>
            </div>
          </div>
          <SuggestionList
            suggestions={suggestions}
            limit={3}
            emptyText="Nothing needs doing right now."
          />
          {suggestions.length > 3 ? (
            <Link className="link-btn top-gap" to="/advisor">
              See all {suggestions.length} things →
            </Link>
          ) : null}
        </div>

        <div className="card dash-safety">
          <h2>Safety check</h2>
          <div className="timer-hero">{countdown}</div>
          <p className="muted small">
            {triggerStatus?.is_triggered
              ? "Your list has been sent to the people you trust."
              : expired
                ? "The clock ran out. Your list is being sent now."
                : !triggerStatus?.is_timer_active
                  ? "Switched off. Press the button once to start it."
                  : "Left before your list is sent to the people you trust, if you go quiet."}
          </p>
          <div className="list top-gap">
            <div className="item row-between">
              <span>People who would be told</span>
              <strong>{contacts.length}</strong>
            </div>
          </div>
          <Link className="btn secondary dash-safety__cta" to="/trigger">Open safety check</Link>
        </div>
      </div>
    </>
  );
}
