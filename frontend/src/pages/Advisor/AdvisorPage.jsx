import { useEffect, useMemo, useState } from "react";
import SectionHeader from "../../components/SectionHeader/SectionHeader";
import SuggestionList from "../../components/Guidance/SuggestionList";
import DriftBars from "../../components/charts/DriftBars";
import ProjectionChart from "../../components/charts/ProjectionChart";
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
    setSaved("Saved. Everything below has been worked out again.");
    setTimeout(() => setSaved(""), 4000);
  }

  const field = (key) => (event) => setDraft({ ...draft, [key]: event.target.value });

  return (
    <>
      <SectionHeader
        title="What to do with your money"
        description="All of this is worked out from the things you listed and the few details below. Every number here comes from your own figures."
      />

      <div className="split-form advisor-top">
        <form className="card advisor-profile" onSubmit={handleSave}>
          <div className="section-header compact">
            <div>
              <h1>About you</h1>
              <p>Kept on this device only. Nobody else sees it, and it is not sent to anyone.</p>
            </div>
          </div>

          <div className="form-grid top-gap">
            <div className="two-col">
              <div className="field">
                <label htmlFor="age">Your age</label>
                <input id="age" type="number" min="16" max="90" value={draft.age} onChange={field("age")} required />
              </div>
              <div className="field">
                <label htmlFor="retire">Stop working at</label>
                <input id="retire" type="number" min="30" max="95" value={draft.retirementAge} onChange={field("retirementAge")} required />
              </div>
            </div>

            <div className="field field-prefixed">
              <label htmlFor="income">What you take home each month</label>
              <input id="income" inputMode="decimal" placeholder="0" value={draft.monthlyIncome}
                     onChange={(e) => setDraft({ ...draft, monthlyIncome: e.target.value.replace(/[^\d.]/g, "") })} />
            </div>

            <div className="field field-prefixed">
              <label htmlFor="expenses">What you spend each month</label>
              <input id="expenses" inputMode="decimal" placeholder="0" value={draft.monthlyExpenses}
                     onChange={(e) => setDraft({ ...draft, monthlyExpenses: e.target.value.replace(/[^\d.]/g, "") })} />
            </div>

            <div className="field">
              <label htmlFor="dependents">People who rely on your income</label>
              <input id="dependents" type="number" min="0" max="12" value={draft.dependents} onChange={field("dependents")} />
            </div>

            <div className="field">
              <label>If your savings dropped for a year</label>
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

            <button type="submit">Save</button>
            {saved ? <div className="notice success">{saved}</div> : null}
          </div>
        </form>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>How you are doing</h2>
                <p>Five things worth checking. We skip any we cannot work out yet.</p>
              </div>
            </div>
            <div className={`health-word tone-${health.tone}`}>{health.grade}</div>
            <p className="muted">{health.label}.</p>
            <div className="meter-track top-gap">
              <div className={`meter-fill tone-${health.tone}`} style={{ width: `${health.score}%` }} />
            </div>

            <div className="pillar-list top-gap">
              {health.pillars.map((pillar) => {
                const state = pillar.score === null
                  ? { mark: "?", tone: "unknown", word: "Cannot tell yet" }
                  : pillar.score >= pillar.max * 0.75
                    ? { mark: "\u2713", tone: "good", word: "Good" }
                    : pillar.score >= pillar.max * 0.4
                      ? { mark: "!", tone: "warning", word: "Could be better" }
                      : { mark: "\u2715", tone: "critical", word: "Needs attention" };
                return (
                  <div className={`pillar tone-${state.tone}`} key={pillar.key}>
                    <span className="pillar__mark" aria-hidden="true">{state.mark}</span>
                    <div>
                      <div className="pillar__head">
                        <strong>{pillar.label}</strong>
                        <span className="pillar__word">{state.word}</span>
                      </div>
                      <p className="muted small">{pillar.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Where your money is, and where it could be</h2>
            <p>
              Someone your age usually keeps about {target.equity} out of every 100 rupees in shares, moving more
              into safer savings as {profile.retirementAge} gets closer. The line down the middle is where that
              would put you. A bar to the left means you have less than that; to the right means more. This covers
              the {formatCurrency(portfolio.investableBase)} you could actually move
              {portfolio.residence > 0 ? ", leaving aside the home you live in" : ""}.
            </p>
          </div>
        </div>

        {portfolio.investableBase > 0 ? (
          <>
            <DriftBars rows={drift} formatValue={formatCurrency} />
            <details className="table-view">
              <summary>Show me the numbers</summary>
              <div className="table-scroll top-gap">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Kind of saving</th>
                      <th className="num">You have</th>
                      <th className="num">Usually about</th>
                      <th className="num">Difference</th>
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
              Money people owe you is counted as cash, since that is what it becomes once paid back. The home you
              live in is left out, because you cannot sell part of it. The easy way to even things up is to put new
              money where you are short, rather than selling what you already have.
            </p>
          </>
        ) : (
          <div className="empty-state">
            <strong>Nothing to compare yet</strong>
            Add some savings besides the home you live in, and this will show how they are spread.
          </div>
        )}
      </div>

      <div className="split-main">
        <div className="stack">
          {plan ? (
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>What to do each month</h2>
                  <p>
                    {formatCurrency(plan.income)} comes in, {formatCurrency(plan.actualSpend)} goes out, so{" "}
                    {formatCurrency(plan.surplus)} is left over. Here is where to send it.
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

              <h3 className="top-gap">And where the saving part should go</h3>
              <div className="table-scroll top-gap">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Put it into</th>
                      <th className="num">Each month</th>
                      <th>What that means</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.investmentSplit.filter((row) => row.amount > 0).map((row) => (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td className="num">{formatCurrency(row.amount)}</td>
                        <td className="muted">{ASSET_CLASSES[row.key]?.blurb || "Money you can reach quickly"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="benchmark-strip top-gap">
                <div>
                  <span>A rough guide many people use</span>
                  <strong className="figure">
                    {formatCurrency(plan.needs)} on must-haves · {formatCurrency(plan.wants)} on nice-to-haves ·{" "}
                    {formatCurrency(plan.future)} put away
                  </strong>
                  <p className="muted small">
                    Half your pay on things you must buy, a third on things you enjoy, a fifth put away. You spend{" "}
                    {formatCurrency(plan.actualSpend)} where the guide would say {formatCurrency(plan.needs + plan.wants)}.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <h2>What to do each month</h2>
              <p className="muted top-gap">
                Add what you earn and spend above, and this turns into a simple monthly plan: how much to keep
                aside, how much to put on your loans, and how much to save.
              </p>
            </div>
          )}

          {portfolio.debts.length > 0 ? (
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>Which loan to clear first</h2>
                  <p>
                    Costliest first. Clearing the one that charges the most interest saves you the most money
                    overall. Write the rate in a loan's notes — like "@ 10.5%" — and we will use it.
                  </p>
                </div>
              </div>
              <div className="table-scroll">
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Loan</th>
                      <th>Who it is with</th>
                      <th className="num">Interest</th>
                      <th className="num">Still to pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.debts.map((debt, index) => (
                      <tr key={debt.id}>
                        <td>{index + 1}</td>
                        <td><strong>{debt.title}</strong></td>
                        <td className="muted">{debt.owner || "—"}</td>
                        <td className="num">{debt.rate !== null ? `${debt.rate}%` : "not given"}</td>
                        <td className="num">{formatCurrency(debt.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted tiny top-gap">
                Pay the usual amount on all of them, then put every spare rupee on the one at the top. Once it is
                gone, add what you were paying on it to the next one down. Each one clears faster than the last.
              </p>
            </div>
          ) : null}
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>When you stop working</h2>
                <p>
                  {projection
                    ? `If you keep saving ${formatCurrency(projection.surplus)} a month and it grows at about ${(projection.blendedReturn * 100).toFixed(1)}% a year. The red line is what you would need, because things cost more every year.`
                    : "Add what you earn and spend, and we can show you what you are on course for."}
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
                    <span>You would have</span>
                    <strong className="figure">{formatCurrency(projection.projected)}</strong>
                  </div>
                  <div>
                    <span>You would need</span>
                    <strong className="figure">{formatCurrency(projection.requiredCorpus)}</strong>
                  </div>
                  <div>
                    <span>{projection.onTrack ? "Spare" : "Short by"}</span>
                    <strong className={`figure ${projection.onTrack ? "is-good" : "is-critical"}`}>
                      {formatCurrency(Math.abs(projection.shortfall || projection.projected - projection.requiredCorpus))}
                    </strong>
                  </div>
                  <div>
                    <span>Save this much instead</span>
                    <strong className="figure">{formatCurrency(projection.requiredMonthly)}</strong>
                  </div>
                </div>
                <p className="muted tiny top-gap">
                  We assume shares grow about {Math.round(ASSET_CLASSES.equity.assumedReturn * 100)}% a year, safe
                  savings about {Math.round(ASSET_CLASSES.bonds.assumedReturn * 100)}%, property about{" "}
                  {Math.round(ASSET_CLASSES.property.assumedReturn * 100)}% and cash about{" "}
                  {Math.round(ASSET_CLASSES.cash.assumedReturn * 100)}%; that you will need 25 years of spending put
                  by; and that prices rise 6% a year. Real life is bumpier than this. Treat it as a direction, not
                  a promise.
                </p>
              </>
            ) : (
              <div className="empty-state">
                <strong>Not enough to work this out</strong>
                Tell us what you earn and spend, and we can show you the years ahead.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Everything worth doing</h2>
            <p>Most important first. {suggestions.length} right now.</p>
          </div>
        </div>
        <SuggestionList suggestions={suggestions} emptyText="Nothing to do right now. That is a good place to be." />
      </div>

      <p className="disclaimer">
        This is general guidance worked out from the numbers you typed in. It is not personal financial advice,
        it knows nothing about your tax, and it cannot see any account you have not listed here. For a big
        decision, talk to someone qualified.
      </p>
    </>
  );
}
