import SectionHeader from "../../components/SectionHeader/SectionHeader";
import { calculateBuckets, currencyTotal, formatCurrency, formatServerDate, getDashboardInsights } from "../../storage";
import "./DashboardPage.css";

export default function DashboardPage({ user, records, contacts, triggerStatus }) {
  const buckets = calculateBuckets(records);
  const insights = getDashboardInsights(records);
  const recentRecords = [...records].slice(0, 10);

  return (
    <>
      <SectionHeader
        title="Dashboard"
        description="A clear overview of your records, trigger timer, and emergency readiness."
      />

      <div className="dashboard-hero-grid">
        <div className="card hero-card warm-theme hero-span-two">
          <span className="eyebrow warm">Emergency readiness</span>
          <h2>Everything important is organized and easy to review for your loved ones.</h2>
          <p className="muted">
            Your records, contacts, final message, and trigger status are all available in one place.
          </p>
        </div>

        <div className="card summary-card">
          <span className="eyebrow">Live countdown</span>
          <div className="timer-hero">{triggerStatus ? `${triggerStatus.seconds_until_trigger}s` : "--"}</div>
          <p className="muted">Time remaining before the Trigger gets Pulled.</p>
        </div>
      </div>

      <div className="stats-grid wide-4">
        <div className="stat-card card accent-debt">
          <span>Amount in debt</span>
          <strong>{formatCurrency(buckets.debt)}</strong>
          <p className="muted">Loans, dues, and outgoing liabilities.</p>
        </div>
        <div className="stat-card card accent-lent">
          <span>Money owed to me</span>
          <strong>{formatCurrency(buckets.lent)}</strong>
          <p className="muted">Expected inflows from people or businesses.</p>
        </div>
        <div className="stat-card card accent-assets">
          <span>Assets</span>
          <strong>{formatCurrency(buckets.assets)}</strong>
          <p className="muted">Insurance, stocks, bonds, property, and other saved value.</p>
        </div>
        <div className="stat-card card accent-total">
          <span>Total recorded amount</span>
          <strong>{formatCurrency(currencyTotal(records))}</strong>
          <p className="muted">Complete value of all recorded entries.</p>
        </div>
      </div>

      <div className="content-grid dashboard-main-grid">
        <div className="card stretch-card">
          <div className="row-between section-spacer wrap-mobile">
            <div>
              <h2>Recent records</h2>
              <p className="muted">Latest records saved for this account.</p>
            </div>
            <span className="pill-muted">{records.length} total records</span>
          </div>
          <div className="record-grid dashboard-record-grid enhanced-grid">
            {recentRecords.length === 0 ? (
              <div className="item muted">No records added yet.</div>
            ) : (
              recentRecords.map((item) => (
                <div className="item rich-item record-card-elevated" key={item.id}>
                  <div className="row-between align-start gap-12">
                    <div>
                      <strong>{item.title}</strong>
                      <div className="muted small-gap">{item.owner || "No person or company added"}</div>
                    </div>
                    <span className="badge gold">{item.category || "Other"}</span>
                  </div>
                  <div className="record-amount">{formatCurrency(item.amount)}</div>
                  <p className="muted small-gap">{item.details || "No details added"}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="stack-grid">
          <div className="card intelligence-card">
            <h2>Highlights</h2>
            <div className="list">
              <div className="item">
                <strong>Highest liability</strong>
                <p className="muted">{insights.highestDebt ? `${insights.highestDebt.title} • ${formatCurrency(insights.highestDebt.amount)}` : "No debt entries yet."}</p>
              </div>
              <div className="item">
                <strong>Largest receivable</strong>
                <p className="muted">{insights.highestOwed ? `${insights.highestOwed.title} • ${formatCurrency(insights.highestOwed.amount)}` : "No money-owed-to-me entries yet."}</p>
              </div>
              <div className="item">
                <strong>Strongest asset</strong>
                <p className="muted">{insights.strongestAsset ? `${insights.strongestAsset.title} • ${formatCurrency(insights.strongestAsset.amount)}` : "No asset-side entries yet."}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Status overview</h2>
            <div className="list">
              <div className="item row-between"><span>Last check-in</span><strong>{formatServerDate(user.last_check_in)}</strong></div>
              <div className="item row-between"><span>Warning mail</span><strong>{triggerStatus?.warning_sent ? "Sent at 15s" : `${triggerStatus?.seconds_until_warning ?? '--'}s left`}</strong></div>
              <div className="item row-between"><span>Final trigger</span><strong>{triggerStatus ? `${triggerStatus.threshold_seconds}s` : "30s"}</strong></div>
              <div className="item row-between"><span>Seconds since check-in</span><strong>{triggerStatus ? triggerStatus.seconds_since_check_in : "--"}</strong></div>
              <div className="item row-between"><span>Trusted contacts</span><strong>{contacts.length}</strong></div>
              <div className="item row-between"><span>Trigger state</span><strong>{user.is_triggered ? "Triggered" : "Monitoring"}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
