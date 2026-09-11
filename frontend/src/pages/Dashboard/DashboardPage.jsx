import { Link } from "react-router-dom";
import SectionHeader from "../../components/SectionHeader/SectionHeader";
import SuggestionList from "../../components/Guidance/SuggestionList";
import AllocationBar from "../../components/charts/AllocationBar";
import ScoreMeter from "../../components/charts/ScoreMeter";
import { allocationSegments, buildAdvice } from "../../advisor";
import { formatCurrency, formatDuration, formatServerDate } from "../../storage";
import "./DashboardPage.css";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage({ user, records, contacts, triggerStatus, financialProfile }) {
  const advice = buildAdvice({
    records,
    contacts,
    user,
    triggerStatus,
    profile: financialProfile,
    currency: formatCurrency,
  });

  const { portfolio, health, plan, profile, suggestions } = advice;
  const firstName = (user.name || "").trim().split(" ")[0] || "there";

  const segments = allocationSegments(portfolio);

  const countdown = triggerStatus?.is_triggered
    ? "Released"
    : !triggerStatus?.is_timer_active
      ? "Not armed"
      : triggerStatus?.seconds_until_trigger !== undefined
        ? formatDuration(triggerStatus.seconds_until_trigger)
        : "—";

  return (
    <>
      <SectionHeader
        eyebrow="Overview"
        title={`${greeting()}, ${firstName}`}
        description="Where your money stands today, what it is doing, and the next thing worth doing about it."
        action={<Link className="btn" to="/advisor">Open the full plan</Link>}
      />

      {!profile.isComplete ? (
        <div className="notice warning dash-prompt">
          <div>
            <strong>Three of the five health pillars are unmeasured.</strong> Add your monthly income and
            expenses and the emergency fund, savings rate, monthly plan and retirement projection all come to life.
          </div>
          <Link className="btn gold" to="/advisor">Complete profile</Link>
        </div>
      ) : null}

      <div className="dash-hero">
        <div className="card card-ledger dash-networth">
          <span className="eyebrow">Net worth</span>
          <div className={`hero-figure ${portfolio.netWorth < 0 ? "is-negative" : ""}`}>
            {formatCurrency(portfolio.netWorth)}
          </div>
          <p className="muted small">
            {formatCurrency(portfolio.assets)} in assets less {formatCurrency(portfolio.liabilities)} owed,
            across {records.length} record{records.length === 1 ? "" : "s"}.
          </p>
          <div className="networth-split">
            <div>
              <span>Assets</span>
              <strong className="figure">{formatCurrency(portfolio.assets)}</strong>
            </div>
            <div>
              <span>Liabilities</span>
              <strong className="figure is-liability">{formatCurrency(portfolio.liabilities)}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>Financial health</h2>
              <p>{health.measuredCount} of {health.totalCount} pillars measured</p>
            </div>
          </div>
          <ScoreMeter
            score={health.score}
            grade={health.grade}
            label={health.label}
            tone={health.tone}
            caption="Emergency fund, debt load, savings rate, diversification and protection, weighted equally."
          />
          <Link className="link-btn dash-inline-link" to="/advisor">See how it breaks down →</Link>
        </div>

        <div className="card dash-watch">
          <span className="eyebrow">Safety trigger</span>
          <div className="timer-hero">{countdown}</div>
          <p className="muted small">
            {triggerStatus?.is_triggered
              ? "Your records have been released to your trusted circle."
              : !triggerStatus?.is_timer_active
                ? "Check in once to arm the inactivity watch."
                : "Remaining before your records go to your trusted circle."}
          </p>
          <div className="list top-gap">
            <div className="item row-between"><span>Last check-in</span><strong className="small">{formatServerDate(user.last_check_in)}</strong></div>
            <div className="item row-between"><span>Trusted contacts</span><strong>{contacts.length}</strong></div>
          </div>
          <Link className="link-btn dash-inline-link" to="/trigger">Manage the trigger →</Link>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card card accent-assets">
          <span>Invested</span>
          <strong>{formatCurrency(portfolio.totals.equity + portfolio.totals.bonds + portfolio.totals.property)}</strong>
          <p>Equity, fixed income and investment property.</p>
        </div>
        <div className="stat-card card accent-total">
          <span>Cash cushion</span>
          <strong>{formatCurrency(portfolio.totals.cash)}</strong>
          <p>
            {health.monthsCovered === null
              ? "Add expenses to see months of cover."
              : `${health.monthsCovered.toFixed(1)} months of expenses.`}
          </p>
        </div>
        <div className="stat-card card accent-lent">
          <span>Owed to you</span>
          <strong>{formatCurrency(portfolio.totals.receivable)}</strong>
          <p>Receivables still to be collected.</p>
        </div>
        <div className="stat-card card accent-plan">
          <span>Monthly surplus</span>
          <strong>{plan ? formatCurrency(plan.surplus) : "—"}</strong>
          <p>
            {plan
              ? `${(plan.savingsRate * 100).toFixed(0)}% of income kept back.`
              : "Income and expenses not set."}
          </p>
        </div>
      </div>

      <div className="split-main">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>How your money is spread</h2>
                <p>Every recorded asset, by class.</p>
              </div>
              <Link className="link-btn" to="/advisor">Target mix →</Link>
            </div>
            <AllocationBar segments={segments} total={portfolio.assets} formatValue={formatCurrency} />
          </div>

          <div className="card">
            <div className="card-head">
              <div>
                <h2>What to do next</h2>
                <p>Ordered by urgency, computed from your own records.</p>
              </div>
              <span className="pill-muted">{suggestions.length} in total</span>
            </div>
            <SuggestionList
              suggestions={suggestions}
              limit={4}
              emptyText="Nothing pressing. Add records to sharpen the guidance."
            />
            {suggestions.length > 4 ? (
              <Link className="link-btn top-gap" to="/advisor">
                See all {suggestions.length} recommendations →
              </Link>
            ) : null}
          </div>
        </div>

        <div className="stack">
          {plan ? (
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>This month</h2>
                  <p>Where your {formatCurrency(plan.surplus)} surplus should go.</p>
                </div>
              </div>
              <div className="list">
                {plan.buckets.map((bucket) => (
                  <div className="item" key={bucket.key}>
                    <div className="row-between">
                      <span>{bucket.label}</span>
                      <strong className="figure">{formatCurrency(bucket.amount)}</strong>
                    </div>
                    <p className="muted tiny">{bucket.note}</p>
                  </div>
                ))}
              </div>
              <Link className="link-btn top-gap" to="/advisor">Full monthly plan →</Link>
            </div>
          ) : (
            <div className="card">
              <h2>This month</h2>
              <p className="muted small top-gap">
                Once your income and expenses are recorded, this becomes a monthly instruction: how much to
                hold back, how much to send at debt, and how much to invest.
              </p>
              <Link className="btn top-gap" to="/advisor">Set it up</Link>
            </div>
          )}

          <div className="card">
            <div className="card-head">
              <div>
                <h2>Recent records</h2>
                <p>{records.length} in the vault.</p>
              </div>
            </div>
            {records.length === 0 ? (
              <div className="empty-state">
                <strong>The vault is empty</strong>
                Add what you own and owe to begin.
              </div>
            ) : (
              <div className="list">
                {records.slice(0, 5).map((item) => (
                  <div className="item recent-record" key={item.id}>
                    <div className="row-between align-start">
                      <div className="flex-1">
                        <strong>{item.title}</strong>
                        <div className="muted tiny">{item.owner || "No counterparty recorded"}</div>
                      </div>
                      <div className="recent-record__right">
                        <span className="figure">{formatCurrency(item.amount)}</span>
                        <span className="badge plain">{item.category || "Other"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link className="link-btn top-gap" to="/records">Open the vault →</Link>
          </div>
        </div>
      </div>
    </>
  );
}
