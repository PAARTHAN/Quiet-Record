/**
 * Quiet Record — money-management advisory engine.
 *
 * Everything here is deterministic and computed in the browser from the user's
 * own records plus the financial profile they enter. No network calls, no model
 * in the loop: the same inputs always produce the same guidance, and every
 * number shown in the UI can be traced back to a rule in this file.
 */

import { safeAmount } from "./storage";

/* ------------------------------------------------------------------ *
 * Asset classes
 * ------------------------------------------------------------------ */

export const ASSET_CLASSES = {
  equity: { key: "equity", label: "Equity", blurb: "Stocks, equity funds, index funds", assumedReturn: 0.11 },
  bonds: { key: "bonds", label: "Fixed income", blurb: "Bonds, FDs, PPF, debt funds", assumedReturn: 0.07 },
  property: { key: "property", label: "Property", blurb: "Land, housing, real estate", assumedReturn: 0.08 },
  cash: { key: "cash", label: "Cash & savings", blurb: "Bank balances, liquid funds", assumedReturn: 0.04 },
  receivable: { key: "receivable", label: "Receivables", blurb: "Money owed to you", assumedReturn: 0.0 },
};

export const ALLOCATION_ORDER = ["equity", "bonds", "property", "cash", "receivable"];
export const TARGET_ORDER = ["equity", "bonds", "property", "liquid"];

export const RISK_PROFILES = {
  conservative: { key: "conservative", label: "Conservative", base: 90, blurb: "Protect what exists; accept slower growth." },
  balanced: { key: "balanced", label: "Balanced", base: 100, blurb: "Steady growth with a real cushion." },
  growth: { key: "growth", label: "Growth", base: 110, blurb: "Accept swings for a larger long-run corpus." },
};

export const DEFAULT_PROFILE = {
  age: 30,
  retirementAge: 60,
  monthlyIncome: "",
  monthlyExpenses: "",
  dependents: 0,
  risk: "balanced",
};

const INFLATION = 0.06;
const CASH_WORDS = /\b(saving|savings|bank|cash|wallet|liquid|emergency|current a\/c|current account)\b/i;
const FD_WORDS = /\b(fd|fixed deposit|rd|recurring deposit|ppf|epf|nps|debenture|treasury|gilt|debt fund)\b/i;
const EQUITY_WORDS = /\b(mutual fund|sip|index|etf|nifty|sensex|share|shares|equity|stock|stocks|demat)\b/i;
const PROPERTY_WORDS = /\b(land|plot|flat|apartment|house|villa|property|real estate)\b/i;

/* ------------------------------------------------------------------ *
 * Classification
 * ------------------------------------------------------------------ */

/**
 * Sort one record into a bucket. Explicit categories win; a record filed as
 * "Other" is read for keywords and otherwise treated as cash.
 */
export function classifyRecord(record) {
  const category = (record.category || "Other").trim().toLowerCase();
  const haystack = `${record.title || ""} ${record.details || ""}`;

  switch (category) {
    case "debt":
    case "bill":
      return "liability";
    case "money owed to me":
      return "receivable";
    case "stock":
      return "equity";
    case "bond":
      return "bonds";
    case "property":
      return "property";
    case "insurance":
      return "protection";
    case "note":
      return "note";
    default:
      break;
  }

  if (EQUITY_WORDS.test(haystack)) return "equity";
  if (FD_WORDS.test(haystack)) return "bonds";
  if (PROPERTY_WORDS.test(haystack)) return "property";
  if (CASH_WORDS.test(haystack)) return "cash";
  return "cash";
}

/** Pull an interest rate out of free text, e.g. "HDFC loan @ 10.5% p.a." */
export function parseRate(record) {
  const match = `${record.title || ""} ${record.details || ""}`.match(/(\d{1,2}(?:\.\d{1,2})?)\s*%/);
  if (!match) return null;
  const rate = Number.parseFloat(match[1]);
  return Number.isFinite(rate) && rate > 0 && rate <= 60 ? rate : null;
}

/* ------------------------------------------------------------------ *
 * Profile helpers
 * ------------------------------------------------------------------ */

export function normalizeProfile(raw) {
  const profile = { ...DEFAULT_PROFILE, ...(raw || {}) };
  const income = safeAmount(profile.monthlyIncome);
  const expenses = safeAmount(profile.monthlyExpenses);
  const age = clamp(Math.round(safeAmount(profile.age)) || DEFAULT_PROFILE.age, 16, 90);
  const retirementAge = clamp(
    Math.round(safeAmount(profile.retirementAge)) || DEFAULT_PROFILE.retirementAge,
    age + 1,
    95,
  );

  return {
    ...profile,
    age,
    retirementAge,
    dependents: clamp(Math.round(safeAmount(profile.dependents)), 0, 12),
    risk: RISK_PROFILES[profile.risk] ? profile.risk : "balanced",
    monthlyIncome: income,
    monthlyExpenses: expenses,
    hasIncome: income > 0,
    hasExpenses: expenses > 0,
    isComplete: income > 0 && expenses > 0,
  };
}

/**
 * Age-and-risk glidepath. Equity falls as retirement nears; what is left is
 * split into a liquid cushion, property, and fixed income.
 */
export function targetAllocation(profile) {
  const { base } = RISK_PROFILES[profile.risk] || RISK_PROFILES.balanced;
  const equity = clamp(base - profile.age, 20, 75);
  const rest = 100 - equity;
  const liquid = Math.round(rest * 0.2);
  const property = Math.round(rest * 0.3);
  const bonds = 100 - equity - liquid - property;
  return { equity, bonds, property, liquid };
}

/* ------------------------------------------------------------------ *
 * Portfolio maths
 * ------------------------------------------------------------------ */

export function buildPortfolio(records = []) {
  const totals = { equity: 0, bonds: 0, property: 0, cash: 0, receivable: 0, liability: 0, protection: 0 };
  const holdings = [];
  const debts = [];

  records.forEach((record) => {
    const bucket = classifyRecord(record);
    const amount = safeAmount(record.amount);
    if (bucket === "note") return;

    totals[bucket] = (totals[bucket] || 0) + amount;

    if (bucket === "liability") {
      debts.push({ ...record, amount, rate: parseRate(record) });
    } else if (bucket !== "protection") {
      holdings.push({ ...record, amount, bucket });
    }
  });

  const assets = totals.equity + totals.bonds + totals.property + totals.cash + totals.receivable;
  const liabilities = totals.liability;
  const liquid = totals.cash + totals.receivable;

  return {
    totals,
    holdings,
    debts: sortDebts(debts),
    assets,
    liabilities,
    liquid,
    netWorth: assets - liabilities,
    protection: totals.protection,
    debtRatio: assets > 0 ? liabilities / assets : liabilities > 0 ? 1 : 0,
    actualAllocation: shares(totals, assets),
    largestHolding: holdings.reduce((top, item) => (!top || item.amount > top.amount ? item : top), null),
  };
}

/**
 * Highest interest rate first — the avalanche method, which clears the most
 * expensive money first. Debts with no stated rate fall back to largest balance.
 */
function sortDebts(debts) {
  return [...debts].sort((a, b) => {
    if (a.rate !== null && b.rate !== null) return b.rate - a.rate;
    if (a.rate !== null) return -1;
    if (b.rate !== null) return 1;
    return b.amount - a.amount;
  });
}

function shares(totals, assets) {
  if (assets <= 0) return { equity: 0, bonds: 0, property: 0, cash: 0, receivable: 0 };
  return ALLOCATION_ORDER.reduce((acc, key) => {
    acc[key] = (totals[key] / assets) * 100;
    return acc;
  }, {});
}

/** Actual mix folded into the four classes the target speaks in. */
export function targetableAllocation(portfolio) {
  const { totals, assets } = portfolio;
  if (assets <= 0) return { equity: 0, bonds: 0, property: 0, liquid: 0 };
  return {
    equity: (totals.equity / assets) * 100,
    bonds: (totals.bonds / assets) * 100,
    property: (totals.property / assets) * 100,
    liquid: ((totals.cash + totals.receivable) / assets) * 100,
  };
}

/* ------------------------------------------------------------------ *
 * Health score
 * ------------------------------------------------------------------ */

const GRADES = [
  { min: 80, grade: "A", label: "Strong", tone: "good" },
  { min: 60, grade: "B", label: "Steady", tone: "good" },
  { min: 40, grade: "C", label: "Needs work", tone: "warning" },
  { min: 0, grade: "D", label: "At risk", tone: "critical" },
];

export function buildHealthScore({ portfolio, profile, contacts, user, triggerStatus }) {
  const pillars = [];
  const monthsCovered = profile.hasExpenses && profile.monthlyExpenses > 0
    ? portfolio.totals.cash / profile.monthlyExpenses
    : null;

  pillars.push({
    key: "emergency",
    label: "Emergency fund",
    max: 20,
    score: monthsCovered === null ? null : clamp((monthsCovered / 6) * 20, 0, 20),
    detail: monthsCovered === null
      ? "Add your monthly expenses to measure this."
      : `${monthsCovered.toFixed(1)} months of expenses held in cash.`,
  });

  pillars.push({
    key: "debt",
    label: "Debt load",
    max: 20,
    score: clamp(20 * (1 - portfolio.debtRatio / 0.5), 0, 20),
    detail: portfolio.liabilities === 0
      ? "No liabilities recorded."
      : `Liabilities are ${(portfolio.debtRatio * 100).toFixed(0)}% of your assets.`,
  });

  const savingsRate = profile.isComplete && profile.monthlyIncome > 0
    ? (profile.monthlyIncome - profile.monthlyExpenses) / profile.monthlyIncome
    : null;

  pillars.push({
    key: "savings",
    label: "Savings rate",
    max: 20,
    score: savingsRate === null ? null : clamp((savingsRate / 0.2) * 20, 0, 20),
    detail: savingsRate === null
      ? "Add income and expenses to measure this."
      : `You keep ${(savingsRate * 100).toFixed(0)}% of what you earn.`,
  });

  const classesHeld = ALLOCATION_ORDER.filter((key) => portfolio.totals[key] > 0).length;
  const topShare = portfolio.assets > 0 && portfolio.largestHolding
    ? portfolio.largestHolding.amount / portfolio.assets
    : 0;
  const diversification = portfolio.assets <= 0
    ? 0
    : 20 * (0.5 * Math.min(1, classesHeld / 4) + 0.5 * (1 - clamp((topShare - 0.35) / 0.5, 0, 1)));

  pillars.push({
    key: "diversification",
    label: "Diversification",
    max: 20,
    score: diversification,
    detail: portfolio.assets <= 0
      ? "No assets recorded yet."
      : `${classesHeld} asset class${classesHeld === 1 ? "" : "es"} held; largest single holding is ${(topShare * 100).toFixed(0)}% of assets.`,
  });

  const annualIncome = profile.monthlyIncome * 12;
  const coverAdequate = annualIncome > 0 && portfolio.protection >= annualIncome * 10;
  let protectionScore = 0;
  if (portfolio.protection > 0) protectionScore += 5;
  if (coverAdequate) protectionScore += 5;
  if ((contacts?.length || 0) >= 2) protectionScore += 5;
  if (user?.last_message) protectionScore += 2.5;
  if (triggerStatus?.is_timer_active) protectionScore += 2.5;

  pillars.push({
    key: "protection",
    label: "Protection & legacy",
    max: 20,
    score: protectionScore,
    detail: portfolio.protection > 0
      ? `${contacts?.length || 0} trusted contact(s); cover recorded.`
      : "No insurance recorded.",
  });

  const measured = pillars.filter((pillar) => pillar.score !== null);
  const earned = measured.reduce((sum, pillar) => sum + pillar.score, 0);
  const available = measured.reduce((sum, pillar) => sum + pillar.max, 0);
  const score = available > 0 ? Math.round((earned / available) * 100) : 0;
  const band = GRADES.find((entry) => score >= entry.min) || GRADES[GRADES.length - 1];

  return {
    score,
    ...band,
    pillars,
    monthsCovered,
    savingsRate,
    measuredCount: measured.length,
    totalCount: pillars.length,
  };
}

/* ------------------------------------------------------------------ *
 * Projection
 * ------------------------------------------------------------------ */

export function buildProjection({ portfolio, profile }) {
  const years = profile.retirementAge - profile.age;
  if (years <= 0 || !profile.isComplete) return null;

  const target = targetAllocation(profile);
  const blendedReturn =
    (target.equity * ASSET_CLASSES.equity.assumedReturn +
      target.bonds * ASSET_CLASSES.bonds.assumedReturn +
      target.property * ASSET_CLASSES.property.assumedReturn +
      target.liquid * ASSET_CLASSES.cash.assumedReturn) /
    100;

  const surplus = Math.max(0, profile.monthlyIncome - profile.monthlyExpenses);
  const monthlyRate = blendedReturn / 12;
  const investedToday = portfolio.totals.equity + portfolio.totals.bonds + portfolio.totals.cash;

  const points = [];
  for (let year = 0; year <= years; year += 1) {
    const months = year * 12;
    const grown = investedToday * (1 + blendedReturn) ** year;
    const contributed = monthlyRate > 0
      ? surplus * (((1 + monthlyRate) ** months - 1) / monthlyRate)
      : surplus * months;
    points.push({ year, age: profile.age + year, value: Math.round(grown + contributed) });
  }

  const annualExpenses = profile.monthlyExpenses * 12;
  const requiredCorpus = Math.round(annualExpenses * (1 + INFLATION) ** years * 25);
  const projected = points[points.length - 1].value;
  const shortfall = Math.max(0, requiredCorpus - projected);

  const requiredMonthly = monthlyRate > 0
    ? (requiredCorpus - investedToday * (1 + blendedReturn) ** years) *
      (monthlyRate / ((1 + monthlyRate) ** (years * 12) - 1))
    : requiredCorpus / (years * 12);

  return {
    years,
    points,
    blendedReturn,
    surplus,
    projected,
    requiredCorpus,
    shortfall: Math.round(shortfall),
    onTrack: shortfall <= 0,
    requiredMonthly: Math.round(Math.max(0, requiredMonthly)),
    coverage: requiredCorpus > 0 ? projected / requiredCorpus : 0,
  };
}

/* ------------------------------------------------------------------ *
 * Monthly plan (50 / 30 / 20, adjusted for the debt and cushion in place)
 * ------------------------------------------------------------------ */

export function buildMonthlyPlan({ portfolio, profile, health }) {
  if (!profile.isComplete) return null;

  const income = profile.monthlyIncome;
  const surplus = Math.max(0, income - profile.monthlyExpenses);
  const target = targetAllocation(profile);
  const monthsCovered = health.monthsCovered ?? 0;

  // Priority order: finish the cushion, then clear expensive debt, then invest.
  const needsCushion = monthsCovered < 6;
  const expensiveDebt = portfolio.debts.filter((debt) => debt.rate === null || debt.rate >= 10);
  const hasExpensiveDebt = expensiveDebt.length > 0;

  let cushionShare = 0;
  let debtShare = 0;
  if (needsCushion && hasExpensiveDebt) {
    cushionShare = 0.4;
    debtShare = 0.4;
  } else if (needsCushion) {
    cushionShare = 0.6;
  } else if (hasExpensiveDebt) {
    debtShare = 0.6;
  }
  const investShare = 1 - cushionShare - debtShare;
  const investable = surplus * investShare;

  return {
    income,
    surplus,
    savingsRate: income > 0 ? surplus / income : 0,
    needs: income * 0.5,
    wants: income * 0.3,
    future: income * 0.2,
    actualSpend: profile.monthlyExpenses,
    buckets: [
      {
        key: "cushion",
        label: "Emergency cushion",
        amount: surplus * cushionShare,
        note: needsCushion
          ? `Build to 6 months of expenses (${(6 - monthsCovered).toFixed(1)} months short).`
          : "Fully funded — nothing more needed here.",
      },
      {
        key: "debt",
        label: "Extra debt repayment",
        amount: surplus * debtShare,
        note: hasExpensiveDebt
          ? `Send it to ${portfolio.debts[0]?.title || "your costliest debt"} first.`
          : "No high-cost debt outstanding.",
      },
      {
        key: "invest",
        label: "Invest",
        amount: investable,
        note: `Split by your target mix: ${target.equity}% equity, ${target.bonds}% fixed income, ${target.liquid}% liquid.`,
      },
    ],
    investmentSplit: [
      { key: "equity", label: ASSET_CLASSES.equity.label, amount: (investable * target.equity) / 100 },
      { key: "bonds", label: ASSET_CLASSES.bonds.label, amount: (investable * target.bonds) / 100 },
      { key: "property", label: ASSET_CLASSES.property.label, amount: (investable * target.property) / 100 },
      { key: "cash", label: "Liquid reserve", amount: (investable * target.liquid) / 100 },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Rebalancing
 * ------------------------------------------------------------------ */

export function buildDrift({ portfolio, profile }) {
  const target = targetAllocation(profile);
  const actual = targetableAllocation(portfolio);

  return TARGET_ORDER.map((key) => {
    const label = key === "liquid" ? "Liquid & receivables" : ASSET_CLASSES[key].label;
    const drift = actual[key] - target[key];
    return {
      key,
      label,
      target: target[key],
      actual: actual[key],
      drift,
      amount: (drift / 100) * portfolio.assets,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Suggestions
 * ------------------------------------------------------------------ */

const PRIORITY = { critical: 0, warning: 1, opportunity: 2, info: 3 };

export function buildSuggestions({ portfolio, profile, health, projection, plan, drift, contacts, user, triggerStatus, currency }) {
  const out = [];
  const money = currency;
  const add = (suggestion) => out.push(suggestion);

  if (portfolio.assets === 0 && portfolio.liabilities === 0) {
    add({
      id: "no-records",
      tone: "info",
      title: "Start with what you already hold",
      detail:
        "Add your bank balances, investments, property and loans in Records. Every figure on this page is computed from them, so the guidance sharpens with each entry.",
      action: { label: "Add a record", to: "/records" },
    });
    return out;
  }

  if (!profile.isComplete) {
    add({
      id: "profile",
      tone: "warning",
      title: "Complete your financial profile",
      detail:
        "Your monthly income and expenses drive the emergency fund, savings rate, monthly plan and retirement projection. Without them three of the five health pillars stay unmeasured.",
      action: { label: "Fill in the profile", to: "/advisor" },
    });
  }

  /* Emergency fund */
  if (health.monthsCovered !== null) {
    const gap = Math.max(0, 6 * profile.monthlyExpenses - portfolio.totals.cash);
    if (health.monthsCovered < 3) {
      add({
        id: "emergency-critical",
        tone: "critical",
        title: "Your emergency fund is thin",
        detail: `You hold ${health.monthsCovered.toFixed(1)} months of expenses in cash. Before any new investment, get to three months — that is the buffer that stops a bad month turning into new debt.`,
        metric: `${money(gap)} to reach six months`,
        action: { label: "Review cash records", to: "/records" },
      });
    } else if (health.monthsCovered < 6) {
      add({
        id: "emergency-topup",
        tone: "warning",
        title: "Top the cushion up to six months",
        detail: `${health.monthsCovered.toFixed(1)} months is a working buffer, but six is the level that covers a job change or a medical gap without touching investments.`,
        metric: `${money(gap)} still to set aside`,
      });
    } else if (health.monthsCovered > 12) {
      add({
        id: "emergency-excess",
        tone: "opportunity",
        title: "You are holding more cash than you need",
        detail: `${health.monthsCovered.toFixed(1)} months sits in cash, earning roughly 4% while inflation runs near 6%. Moving the excess above six months into your target mix puts it back to work.`,
        metric: `${money(portfolio.totals.cash - 6 * profile.monthlyExpenses)} available to deploy`,
      });
    }
  }

  /* Debt */
  if (portfolio.debts.length > 0) {
    const [first] = portfolio.debts;
    const rated = portfolio.debts.filter((debt) => debt.rate !== null);
    add({
      id: "debt-order",
      tone: portfolio.debtRatio > 0.5 ? "critical" : "warning",
      title: `Clear ${first.title} first`,
      detail: rated.length > 0
        ? `Paying the highest rate first costs you the least overall. ${first.rate !== null ? `${first.title} carries the highest stated rate at ${first.rate}%.` : `${first.title} is your largest balance and carries no stated rate.`} Add a rate like "12%" to a record's details and it will be ordered properly here.`
        : `None of your debts record an interest rate, so they are ordered by balance. Add the rate to each record's details (for example "@ 10.5%") and the payoff order will follow the avalanche method instead.`,
      metric: `${money(first.amount)} outstanding`,
      action: { label: "Open records", to: "/records" },
    });

    if (portfolio.debtRatio > 0.5) {
      add({
        id: "debt-ratio",
        tone: "critical",
        title: "Debt is outrunning your assets",
        detail: `Liabilities are ${(portfolio.debtRatio * 100).toFixed(0)}% of everything you own. Above 50% a single income interruption becomes hard to absorb. Pause new investing beyond your cushion and direct the surplus at the balance until this falls under 40%.`,
        metric: `${money(portfolio.liabilities)} owed against ${money(portfolio.assets)} in assets`,
      });
    }
  }

  /* Rebalancing */
  drift
    .filter((row) => Math.abs(row.drift) >= 8 && portfolio.assets > 0)
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))
    .slice(0, 2)
    .forEach((row) => {
      const under = row.drift < 0;
      add({
        id: `drift-${row.key}`,
        tone: "opportunity",
        title: `${under ? "Underweight" : "Overweight"} ${row.label.toLowerCase()}`,
        detail: under
          ? `Your target mix for a ${profile.age}-year-old on a ${RISK_PROFILES[profile.risk].label.toLowerCase()} plan is ${row.target}% ${row.label.toLowerCase()}; you hold ${row.actual.toFixed(0)}%. Direct new money here until the gap closes rather than selling something else.`
          : `You hold ${row.actual.toFixed(0)}% against a ${row.target}% target. Rather than selling, route new contributions elsewhere until the rest of the portfolio catches up.`,
        metric: `${money(Math.abs(row.amount))} ${under ? "below" : "above"} target`,
      });
    });

  /* Concentration */
  if (portfolio.largestHolding && portfolio.assets > 0) {
    const share = portfolio.largestHolding.amount / portfolio.assets;
    if (share > 0.35 && portfolio.largestHolding.bucket !== "property") {
      add({
        id: "concentration",
        tone: "warning",
        title: `${portfolio.largestHolding.title} is ${(share * 100).toFixed(0)}% of your assets`,
        detail:
          "A single holding above a third of everything you own ties your outcome to one company or counterparty. Spread new contributions across other holdings until no single position sits above 20%.",
        metric: `${money(portfolio.largestHolding.amount)} in one position`,
      });
    }
  }

  /* Protection */
  const annualIncome = profile.monthlyIncome * 12;
  if (portfolio.protection === 0) {
    add({
      id: "no-insurance",
      tone: profile.dependents > 0 ? "critical" : "warning",
      title: "No insurance is recorded",
      detail: profile.dependents > 0
        ? `With ${profile.dependents} dependent(s), term cover is the cheapest protection you can buy${annualIncome > 0 ? `. A common benchmark is ten to twelve times annual income — around ${money(annualIncome * 10)} for you` : ""}. Health cover matters just as much: one hospital stay can undo years of saving.`
        : "Even without dependents, health cover protects your savings from a single hospital admission. Record any policy you hold so your trusted contacts can find it.",
      action: { label: "Record a policy", to: "/records" },
    });
  } else if (annualIncome > 0 && portfolio.protection < annualIncome * 10) {
    add({
      id: "thin-insurance",
      tone: "warning",
      title: "Your recorded cover looks light",
      detail: `You have ${money(portfolio.protection)} recorded against a common benchmark of ten times annual income. Term cover is priced low at your age and gets more expensive every year you wait.`,
      metric: `${money(annualIncome * 10 - portfolio.protection)} below the benchmark`,
    });
  }

  /* Savings rate & investing */
  if (health.savingsRate !== null) {
    if (health.savingsRate <= 0) {
      add({
        id: "negative-savings",
        tone: "critical",
        title: "You are spending everything you earn",
        detail: `Expenses of ${money(profile.monthlyExpenses)} against income of ${money(profile.monthlyIncome)} leave nothing to invest, and any surprise has to go on credit. Finding even 10% — ${money(profile.monthlyIncome * 0.1)} a month — changes the whole plan.`,
      });
    } else if (health.savingsRate < 0.2) {
      add({
        id: "low-savings",
        tone: "warning",
        title: `Lift your savings rate towards 20%`,
        detail: `You keep ${(health.savingsRate * 100).toFixed(0)}% of your income. Twenty percent is the level at which a normal career funds a normal retirement; every point above that buys years of freedom.`,
        metric: `${money(profile.monthlyIncome * 0.2 - (profile.monthlyIncome - profile.monthlyExpenses))} a month to close the gap`,
      });
    } else if (plan && plan.buckets[2].amount > 0) {
      add({
        id: "invest-surplus",
        tone: "opportunity",
        title: `Put ${money(plan.buckets[2].amount)} to work each month`,
        detail: `After your cushion and debt priorities, that is what is free to invest. Automate it on payday — a standing instruction on the first of the month beats deciding again every month.`,
        metric: `${money(plan.surplus)} monthly surplus`,
        action: { label: "See the split", to: "/advisor" },
      });
    }
  }

  /* Receivables */
  if (portfolio.totals.receivable > 0 && portfolio.assets > 0) {
    const share = portfolio.totals.receivable / portfolio.assets;
    if (share > 0.15) {
      add({
        id: "receivables",
        tone: "warning",
        title: "A large share of your net worth is money you do not hold",
        detail: `${(share * 100).toFixed(0)}% of your assets are receivables. They earn nothing while outstanding and depend on someone else paying. Set a date to collect the largest ones and record the outcome.`,
        metric: `${money(portfolio.totals.receivable)} owed to you`,
        action: { label: "Review receivables", to: "/records" },
      });
    }
  }

  /* Retirement */
  if (projection) {
    if (!projection.onTrack) {
      add({
        id: "retirement-gap",
        tone: "warning",
        title: `Your retirement plan is ${money(projection.shortfall)} short`,
        detail: `At ${money(projection.surplus)} invested a month and a blended ${(projection.blendedReturn * 100).toFixed(1)}% return, you reach ${money(projection.projected)} by ${profile.retirementAge}. Funding today's spending at 6% inflation needs ${money(projection.requiredCorpus)}. Raising the monthly amount to ${money(projection.requiredMonthly)} closes it.`,
        metric: `${money(projection.requiredMonthly - projection.surplus)} more a month`,
        action: { label: "Open the projection", to: "/advisor" },
      });
    } else {
      add({
        id: "retirement-ok",
        tone: "good",
        title: "You are on track for retirement",
        detail: `Your current pace reaches ${money(projection.projected)} by ${profile.retirementAge} against a ${money(projection.requiredCorpus)} requirement. Keep the contribution rising with your income and this holds.`,
        metric: `${(projection.coverage * 100).toFixed(0)}% of the target corpus`,
      });
    }
  }

  /* Legacy readiness — the reason this vault exists */
  if ((contacts?.length || 0) === 0) {
    add({
      id: "no-contacts",
      tone: "critical",
      title: "No one can reach this record",
      detail:
        "A complete vault with no trusted contacts releases to nobody. Add at least two people so a single unreachable contact does not break the chain.",
      action: { label: "Add a contact", to: "/contacts" },
    });
  } else if (contacts.length === 1) {
    add({
      id: "one-contact",
      tone: "warning",
      title: "Add a second trusted contact",
      detail: "One contact is a single point of failure. A second person, ideally in a different household, makes the release far more reliable.",
      action: { label: "Add a contact", to: "/contacts" },
    });
  }

  if (!user?.last_message) {
    add({
      id: "no-message",
      tone: "info",
      title: "Write your final message",
      detail: "Your records explain what you owned. A short message explains what you meant. It travels with the report to your trusted contacts.",
      action: { label: "Write it now", to: "/profile" },
    });
  }

  if (triggerStatus && !triggerStatus.is_timer_active && !triggerStatus.is_triggered) {
    add({
      id: "timer-off",
      tone: "warning",
      title: "The safety trigger is not armed",
      detail: "Nothing will be released if you become unreachable until you check in once and start the timer.",
      action: { label: "Arm the trigger", to: "/trigger" },
    });
  }

  return out.sort((a, b) => PRIORITY[a.tone] - PRIORITY[b.tone]);
}

/* ------------------------------------------------------------------ *
 * One call to build everything the dashboard needs
 * ------------------------------------------------------------------ */

export function buildAdvice({ records, contacts, user, triggerStatus, profile: rawProfile, currency }) {
  const profile = normalizeProfile(rawProfile);
  const portfolio = buildPortfolio(records);
  const health = buildHealthScore({ portfolio, profile, contacts, user, triggerStatus });
  const projection = buildProjection({ portfolio, profile });
  const plan = buildMonthlyPlan({ portfolio, profile, health });
  const drift = buildDrift({ portfolio, profile });
  const suggestions = buildSuggestions({
    portfolio, profile, health, projection, plan, drift, contacts, user, triggerStatus, currency,
  });

  return { profile, portfolio, health, projection, plan, drift, suggestions, target: targetAllocation(profile) };
}

/* ------------------------------------------------------------------ */

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
