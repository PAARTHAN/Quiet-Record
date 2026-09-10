import { useEffect, useMemo, useState } from "react";
import SectionHeader from "../../components/SectionHeader/SectionHeader";
import SuggestionList from "../../components/Guidance/SuggestionList";
import DriftBars from "../../components/charts/DriftBars";
import ProjectionChart from "../../components/charts/ProjectionChart";
import ScoreMeter from "../../components/charts/ScoreMeter";
import { ASSET_CLASSES, DEFAULT_PROFILE, RISK_PROFILES, buildAdvice } from "../../advisor";
import { formatCompactCurrency, formatCurrency } from "../../storage";
import "./AdvisorPage.css";

export default function AdvisorPage({ user, records, contacts, triggerStatus, financialProfile, saveProfile }) {
  const [draft, setDraft] = useState(() => ({ ...DEFAULT_PROFILE, ...(financialProfile || {}) }));
  const [saved, setSaved] = useState("");

  // The stored profile is read after the account resolves, so it can arrive a
  // render or two later than this form. Re-seed the fields when it does.
  useEffect(() => {
    if (financialProfile) setDraft({ ...DEFAULT_PROFILE, ...financialProfile });
  }, [financialProfile]);

  const advice = useMemo(
    () => buildAdvice({
      records,
      contacts,
      user,
      triggerStatus,
      profile: financialProfile,
      currency: formatCurrency,
    }),
    [records, contacts, user, triggerStatus, financialProfile],
  );

  const { portfolio, health, plan, profile, projection, drift, suggestions, target } = advice;

  function handleSave(event) {
    event.preventDefault();
    saveProfile(draft);
    setSaved("Profile saved. Every figure below has been recalculated.");
    setTimeout(() => setSaved(""), 4000);
  }

  const field = (key) => (event) => setDraft({ ...draft, [key]: event.target.value });

  return (
    <>
      <SectionHeader
        eyebrow="Guidance"
        title="Your money plan"
        description="Everything here is worked out from your own records and the profile below. The rules are fixed and the arithmetic is shown, so you can check any number rather than take it on trust."
      />

      <div className="split-form advisor-top">
        <form className="card advisor-profile" onSubmit={handleSave}>
          <div className="section-header compact">
            <div>
              <h1>Financial profile</h1>
              <p>Held in this browser only. It never reaches the server or the legacy report.</p>
            </div>
          </div>

          <div className="form-grid top-gap">
            <div className="two-col">
              <div className="field">
                <label htmlFor="age">Age</label>
                <input id="age" type="number" min="16" max="90" value={draft.age} onChange={field("age")} required />
              </div>
              <div className="field">
                <label htmlFor="retire">Retire at</label>
                <input id="retire" type="number" min="30" max="95" value={draft.retirementAge} onChange={field("retirementAge")} required />
              </div>
            </div>

            <div className="field field-prefixed">
              <label htmlFor="income">Monthly income (take-home)</label>
              <input id="income" inputMode="decimal" placeholder="0" value={draft.monthlyIncome}
                     onChange={(e) => setDraft({ ...draft, monthlyIncome: e.target.value.replace(/[^\d.]/g, "") })} />
            </div>

            <div className="field field-prefixed">
              <label htmlFor="expenses">Monthly expenses</label>
              <input id="expenses" inputMode="decimal" placeholder="0" value={draft.monthlyExpenses}
                     onChange={(e) => setDraft({ ...draft, monthlyExpenses: e.target.value.replace(/[^\d.]/g, "") })} />
            </div>

            <div className="field">
              <label htmlFor="dependents">People who depend on this income</label>
              <input id="dependents" type="number" min="0" max="12" value={draft.dependents} onChange={field("dependents")} />
            </div>

            <div className="field">
              <label>Risk appetite</label>
              <div className="segmented">
                {Object.values(RISK_PROFILES).map((option) => (
                  <button
                    type="button"
                    key={option.key}
                    className={draft.risk === option.key ? "is-active" : ""}
                    onClick={() => setDraft({ ...draft, risk: option.key })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="hint">{RISK_PROFILES[draft.risk]?.blurb}</span>
            </div>

            <button type="submit">Save and recalculate</button>
            {saved ? <div className="notice success">{saved}</div> : null}
          </div>
        </form>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Financial health</h2>
                <p>Five pillars, twenty points each. Unmeasured pillars are excluded rather than scored as zero.</p>
              </div>
            </div>
            <ScoreMeter score={health.score} grade={health.grade} label={health.label} tone={health.tone} />

            <div className="pillar-list top-gap">
              {health.pillars.map((pillar) => (
                <div className="pillar" key={pillar.key}>
                  <div className="pillar__head">
                    <span>{pillar.label}</span>
                    <strong className="figure">
                      {pillar.score === null ? "—" : `${pillar.score.toFixed(0)}/${pillar.max}`}
                    </strong>
                  </div>
                  <div className="meter-track pillar__meter">
                    <div
                      className="meter-fill"
                      style={{ width: `${pillar.score === null ? 0 : (pillar.score / pillar.max) * 100}%` }}
                    />
                  </div>
                  <p className="muted tiny">{pillar.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Target mix versus what you hold</h2>
            <p>
              At {profile.age}, on a {RISK_PROFILES[profile.risk].label.toLowerCase()} plan, the glidepath puts{" "}
              {target.equity}% in equity and shifts towards fixed income as {profile.retirementAge} approaches.
              Bars run left of the line when you are under target and right when over.
            </p>
          </div>
        </div>

        {portfolio.assets > 0 ? (
          <>
            <DriftBars rows={drift} formatValue={formatCurrency} />
            <details className="table-view">
              <summary>Read as a table</summary>
              <div className="table-scroll top-gap">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Asset class</th>
                      <th className="num">Held</th>
                      <th className="num">Target</th>
                      <th className="num">Drift</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drift.map((row) => (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td className="num">{row.actual.toFixed(1)}%</td>
                        <td className="num">{row.target}%</td>
                        <td className="num">{row.drift >= 0 ? "+" : "−"}{Math.abs(row.drift).toFixed(1)} pts</td>
                        <td className="num">{formatCurrency(Math.abs(row.amount))} {row.drift < 0 ? "short" : "over"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <p className="muted tiny top-gap">
              Receivables are counted as liquid here — they become cash once collected. Rebalance by directing new
              money at whatever is short, rather than selling what is long; selling can trigger tax and costs.
            </p>
          </>
        ) : (
          <div className="empty-state">
            <strong>No assets recorded</strong>
            Add your holdings in Records and the target comparison appears here.
          </div>
        )}
      </div>

      <div className="split-main">
        <div className="stack">
          {plan ? (
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>Your monthly instruction</h2>
                  <p>
                    {formatCurrency(plan.income)} in, {formatCurrency(plan.actualSpend)} out,{" "}
                    {formatCurrency(plan.surplus)} left over — a {(plan.savingsRate * 100).toFixed(0)}% savings rate.
                  </p>
                </div>
              </div>

              <div className="plan-buckets">
                {plan.buckets.map((bucket) => (
                  <div className={`plan-bucket ${bucket.amount <= 0 ? "is-empty" : ""}`} key={bucket.key}>
                    <span className="eyebrow">{bucket.label}</span>
                    <strong className="figure">{formatCurrency(bucket.amount)}</strong>
                    <p className="muted tiny">{bucket.note}</p>
                  </div>
                ))}
              </div>

              <h3 className="top-gap">Where the invested share goes</h3>
              <div className="table-scroll top-gap">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Destination</th>
                      <th className="num">Each month</th>
                      <th>What this means in practice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.investmentSplit.filter((row) => row.amount > 0).map((row) => (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td className="num">{formatCurrency(row.amount)}</td>
                        <td className="muted">{ASSET_CLASSES[row.key]?.blurb || "Kept accessible"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="benchmark-strip top-gap">
                <div>
                  <span>50 / 30 / 20 benchmark</span>
                  <strong className="figure">
                    {formatCurrency(plan.needs)} needs · {formatCurrency(plan.wants)} wants · {formatCurrency(plan.future)} future
                  </strong>
                  <p className="muted tiny">
                    You spend {formatCurrency(plan.actualSpend)} against a {formatCurrency(plan.needs + plan.wants)} guide
                    for needs and wants combined.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <h2>Your monthly instruction</h2>
              <p className="muted top-gap">
                Add your income and expenses in the profile above and this becomes a specific monthly plan:
                what to hold back for emergencies, what to send at debt, and what to invest where.
              </p>
            </div>
          )}

          {portfolio.debts.length > 0 ? (
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>Debt payoff order</h2>
                  <p>
                    Highest interest rate first — the avalanche method, which costs the least in total interest.
                    Write a rate into a record's details (for example "@ 10.5%") and it is picked up here.
                  </p>
                </div>
              </div>
              <div className="table-scroll">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Debt</th>
                      <th>Counterparty</th>
                      <th className="num">Rate</th>
                      <th className="num">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.debts.map((debt, index) => (
                      <tr key={debt.id}>
                        <td>{index + 1}</td>
                        <td><strong>{debt.title}</strong></td>
                        <td className="muted">{debt.owner || "—"}</td>
                        <td className="num">{debt.rate !== null ? `${debt.rate}%` : "not stated"}</td>
                        <td className="num">{formatCurrency(debt.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted tiny top-gap">
                Pay the minimum on everything, then send every spare rupee at the debt at the top of this list.
                When it clears, move to the next — the payment you were making rolls down with you.
              </p>
            </div>
          ) : null}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>Retirement projection</h2>
                <p>
                  {projection
                    ? `Your investments compounding at a blended ${(projection.blendedReturn * 100).toFixed(1)}%, plus ${formatCurrency(projection.surplus)} a month, against what today's spending will cost at 6% inflation.`
                    : "Add income, expenses and an age to project the corpus you are on course for."}
                </p>
              </div>
            </div>

            {projection ? (
              <>
                <ProjectionChart
                  points={projection.points}
                  required={projection.requiredCorpus}
                  formatCompact={formatCompactCurrency}
                  formatValue={formatCurrency}
                />
                <div className="projection-facts">
                  <div>
                    <span>On course for</span>
                    <strong className="figure">{formatCurrency(projection.projected)}</strong>
                  </div>
                  <div>
                    <span>Will need</span>
                    <strong className="figure">{formatCurrency(projection.requiredCorpus)}</strong>
                  </div>
                  <div>
                    <span>{projection.onTrack ? "Surplus" : "Shortfall"}</span>
                    <strong className={`figure ${projection.onTrack ? "is-good" : "is-critical"}`}>
                      {formatCurrency(Math.abs(projection.shortfall || projection.projected - projection.requiredCorpus))}
                    </strong>
                  </div>
                  <div>
                    <span>Needed monthly</span>
                    <strong className="figure">{formatCurrency(projection.requiredMonthly)}</strong>
                  </div>
                </div>
                <p className="muted tiny top-gap">
                  Assumes {Math.round(ASSET_CLASSES.equity.assumedReturn * 100)}% from equity,{" "}
                  {Math.round(ASSET_CLASSES.bonds.assumedReturn * 100)}% from fixed income,{" "}
                  {Math.round(ASSET_CLASSES.property.assumedReturn * 100)}% from property and{" "}
                  {Math.round(ASSET_CLASSES.cash.assumedReturn * 100)}% on cash, blended to your target mix; a corpus of
                  25× annual expenses; and 6% inflation. Real returns vary year to year — this is a direction of
                  travel, not a forecast.
                </p>
              </>
            ) : (
              <div className="empty-state">
                <strong>Not enough to project yet</strong>
                Income and expenses are what turn records into a plan.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Every recommendation</h2>
            <p>Ordered most urgent first. {suggestions.length} open right now.</p>
          </div>
        </div>
        <SuggestionList suggestions={suggestions} emptyText="Nothing outstanding — a rare and good place to be." />
      </div>

      <p className="disclaimer">
        Quiet Record produces general guidance from arithmetic on the figures you enter. It is not personal
        financial advice, it does not know your tax position, and it cannot see accounts you have not recorded.
        For decisions that matter, take it to a qualified adviser who can.
      </p>
    </>
  );
}
