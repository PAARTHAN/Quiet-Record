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
  equity: { key: "equity", label: "Shares", blurb: "Shares, mutual funds, SIPs", assumedReturn: 0.11 },
  bonds: { key: "bonds", label: "Safe savings", blurb: "FD, PPF, bonds — slow but steady", assumedReturn: 0.07 },
  property: { key: "property", label: "Property you rent out", blurb: "Land or a flat you do not live in", assumedReturn: 0.08 },
  cash: { key: "cash", label: "Cash in the bank", blurb: "Money you can use today", assumedReturn: 0.04 },
  receivable: { key: "receivable", label: "Money people owe you", blurb: "Lent out, not back yet", assumedReturn: 0.0 },
  residence: { key: "residence", label: "The home you live in", blurb: "Yours, but you cannot spend it", assumedReturn: 0.08 },
};

export const ALLOCATION_ORDER = ["equity", "bonds", "property", "cash", "receivable"];
export const TARGET_ORDER = ["equity", "bonds", "property", "liquid"];

export const RISK_PROFILES = {
  conservative: { key: "conservative", label: "Play it safe", base: 90, blurb: "You would rather your money grew slowly than dropped in value." },
  balanced: { key: "balanced", label: "In between", base: 100, blurb: "Some ups and downs are fine if it grows well over the years." },
  growth: { key: "growth", label: "Take a chance", base: 110, blurb: "You can watch it fall in a bad year without losing sleep." },
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
const RESIDENCE_WORDS = /\b(self[- ]?occupied|primary residence|own residence|main home|i live here|we live here|live in it|home i live in|residence)\b/i;

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
      return RESIDENCE_WORDS.test(haystack) ? "residence" : "property";
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
  const totals = { equity: 0, bonds: 0, property: 0, residence: 0, cash: 0, receivable: 0, liability: 0, protection: 0 };
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

  const assets =
    totals.equity + totals.bonds + totals.property + totals.residence + totals.cash + totals.receivable;
  const liabilities = totals.liability;
  const liquid = totals.cash + totals.receivable;

  // A home you live in counts towards net worth but not towards the mix you
  // are asked to rebalance — you cannot sell a third of the house you sleep in.
  const investableBase = assets - totals.residence;
  const investableHoldings = holdings.filter((item) => item.bucket !== "residence");

  return {
    totals,
    holdings,
    investableHoldings,
    debts: sortDebts(debts),
    assets,
    investableBase,
    residence: totals.residence,
    liabilities,
    liquid,
    netWorth: assets - liabilities,
    protection: totals.protection,
    debtRatio: assets > 0 ? liabilities / assets : liabilities > 0 ? 1 : 0,
    actualAllocation: shares(displayTotals(totals), assets),
    largestHolding: investableHoldings.reduce((top, item) => (!top || item.amount > top.amount ? item : top), null),
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

/** Five display slots; the home is shown inside Property, not as a sixth hue. */
export function displayTotals(totals) {
  return { ...totals, property: totals.property + totals.residence };
}

/** The five slices the allocation bar draws, in validated palette order. */
export function allocationSegments(portfolio) {
  const { totals } = portfolio;
  const shown = displayTotals(totals);

  // The property slice also carries the home you live in, so name it honestly
  // rather than calling someone's house a rental.
  const propertyLabel = totals.residence > 0 && totals.property > 0
    ? "Property, including your home"
    : totals.residence > 0
      ? "The home you live in"
      : ASSET_CLASSES.property.label;

  return ALLOCATION_ORDER.map((key) => ({
    key,
    label: key === "property" ? propertyLabel : ASSET_CLASSES[key].label,
    value: shown[key],
  }));
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
  const { totals, investableBase } = portfolio;
  if (investableBase <= 0) return { equity: 0, bonds: 0, property: 0, liquid: 0 };
  return {
    equity: (totals.equity / investableBase) * 100,
    bonds: (totals.bonds / investableBase) * 100,
    property: (totals.property / investableBase) * 100,
    liquid: ((totals.cash + totals.receivable) / investableBase) * 100,
  };
}

/* ------------------------------------------------------------------ *
 * Health score
 * ------------------------------------------------------------------ */

const GRADES = [
  { min: 80, grade: "Very good", label: "You are in good shape", tone: "good" },
  { min: 60, grade: "Good", label: "Doing alright, a few things to tidy", tone: "good" },
  { min: 40, grade: "Could be better", label: "A few things need attention", tone: "warning" },
  { min: 0, grade: "Needs work", label: "Some important things are missing", tone: "critical" },
];

export function buildHealthScore({ portfolio, profile, contacts, user, triggerStatus }) {
  const pillars = [];
  const monthsCovered = profile.hasExpenses && profile.monthlyExpenses > 0
    ? portfolio.totals.cash / profile.monthlyExpenses
    : null;

  pillars.push({
    key: "emergency",
    label: "Money set aside for emergencies",
    max: 20,
    score: monthsCovered === null ? null : clamp((monthsCovered / 6) * 20, 0, 20),
    detail: monthsCovered === null
      ? "Tell us what you spend each month and we can check this."
      : `You have enough cash to cover about ${monthsCovered.toFixed(1)} months of spending.`,
  });

  pillars.push({
    key: "debt",
    label: "How much you owe",
    max: 20,
    score: clamp(20 * (1 - portfolio.debtRatio / 0.5), 0, 20),
    detail: portfolio.liabilities === 0
      ? "You have not listed any loans or dues."
      : `For every ₹100 you own, you owe ₹${(portfolio.debtRatio * 100).toFixed(0)}.`,
  });

  const savingsRate = profile.isComplete && profile.monthlyIncome > 0
    ? (profile.monthlyIncome - profile.monthlyExpenses) / profile.monthlyIncome
    : null;

  pillars.push({
    key: "savings",
    label: "How much you keep each month",
    max: 20,
    score: savingsRate === null ? null : clamp((savingsRate / 0.2) * 20, 0, 20),
    detail: savingsRate === null
      ? "Tell us what you earn and spend and we can check this."
      : `Out of every ₹100 you earn, you keep ₹${(savingsRate * 100).toFixed(0)}.`,
  });

  const classesHeld = ALLOCATION_ORDER.filter((key) => portfolio.totals[key] > 0).length;
  const topShare = portfolio.investableBase > 0 && portfolio.largestHolding
    ? portfolio.largestHolding.amount / portfolio.investableBase
    : 0;
  const diversification = portfolio.investableBase <= 0
    ? 0
    : 20 * (0.5 * Math.min(1, classesHeld / 4) + 0.5 * (1 - clamp((topShare - 0.35) / 0.5, 0, 1)));

  pillars.push({
    key: "diversification",
    label: "Money spread across different places",
    max: 20,
    score: diversification,
    detail: portfolio.investableBase <= 0
      ? "Nothing listed yet that we can look at."
      : `Your savings sit in ${classesHeld} different place${classesHeld === 1 ? "" : "s"}. The biggest single one holds ${(topShare * 100).toFixed(0)}% of it.`,
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
    label: "Insurance and who can reach this",
    max: 20,
    score: protectionScore,
    detail: portfolio.protection > 0
      ? `Insurance listed, and ${contacts?.length || 0} ${(contacts?.length || 0) === 1 ? "person" : "people"} can be told if something happens to you.`
      : "You have not listed any insurance.",
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
        label: "Money for emergencies",
        amount: Math.round(surplus * cushionShare),
        note: needsCushion
          ? `Until you have six months of spending put by. You are about ${(6 - monthsCovered).toFixed(1)} months short.`
          : "You already have enough set aside. Nothing more needed here.",
      },
      {
        key: "debt",
        label: "Extra towards loans",
        amount: Math.round(surplus * debtShare),
        note: hasExpensiveDebt
          ? `On top of your normal payments, and all of it to ${portfolio.debts[0]?.title || "the costliest one"}.`
          : "Nothing expensive left to clear. Well done.",
      },
      {
        key: "invest",
        label: "Save and grow",
        amount: Math.round(investable),
        note: "Split between shares, safer savings, and a bit kept in the bank. The table below gives the amounts.",
      },
    ],
    investmentSplit: monthlySplit(investable, target),
  };
}

/**
 * A monthly amount can go into shares, safe savings or the bank. Property is
 * not bought in monthly instalments, so its share of the target is spread over
 * the two growth options rather than printed as an impossible instruction.
 */
function monthlySplit(investable, target) {
  const growth = target.equity + target.bonds;
  const spread = growth > 0 ? target.property / growth : 0;
  const equityShare = target.equity * (1 + spread);
  const bondShare = target.bonds * (1 + spread);

  return [
    { key: "equity", label: ASSET_CLASSES.equity.label, amount: Math.round((investable * equityShare) / 100) },
    { key: "bonds", label: ASSET_CLASSES.bonds.label, amount: Math.round((investable * bondShare) / 100) },
    { key: "cash", label: "Kept handy in the bank", amount: Math.round((investable * target.liquid) / 100) },
  ];
}

/* ------------------------------------------------------------------ *
 * Rebalancing
 * ------------------------------------------------------------------ */

export function buildDrift({ portfolio, profile }) {
  const target = targetAllocation(profile);
  const actual = targetableAllocation(portfolio);

  return TARGET_ORDER.map((key) => {
    const label = key === "liquid" ? "Cash and money owed to you" : ASSET_CLASSES[key].label;
    const drift = actual[key] - target[key];
    return {
      key,
      label,
      target: target[key],
      actual: actual[key],
      drift,
      amount: (drift / 100) * portfolio.investableBase,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Suggestions
 * ------------------------------------------------------------------ */

const PRIORITY = { critical: 0, warning: 1, opportunity: 2, good: 3, info: 4 };

export function buildSuggestions({ portfolio, profile, health, projection, plan, drift, contacts, user, triggerStatus, currency }) {
  const out = [];
  const money = currency;
  const add = (suggestion) => out.push(suggestion);

  if (portfolio.assets === 0 && portfolio.liabilities === 0) {
    add({
      id: "no-records",
      tone: "info",
      title: "Start by listing what you have",
      detail:
        "Add your bank balance, any savings, your house, and anything you owe. Everything on this page is worked out from that list, so the more you add, the more useful this gets.",
      action: { label: "Add something", to: "/records" },
    });
    return out;
  }

  if (!profile.isComplete) {
    add({
      id: "profile",
      tone: "warning",
      title: "Tell us what you earn and spend",
      detail:
        "Two numbers — what comes in each month and what goes out — let us tell you how much to save, what to do with it, and whether you will have enough later. Without them we are guessing.",
      action: { label: "Add the two numbers", to: "/advisor" },
    });
  }

  /* Emergency fund */
  if (health.monthsCovered !== null) {
    const gap = Math.max(0, 6 * profile.monthlyExpenses - portfolio.totals.cash);
    if (health.monthsCovered < 3) {
      add({
        id: "emergency-critical",
        tone: "critical",
        title: "Keep more money aside for emergencies",
        detail: `Right now your cash would cover about ${health.monthsCovered.toFixed(1)} months if your income stopped. Try to get that to three months before you put money anywhere else. This is what stops a bad month turning into a loan.`,
        metric: `${money(gap)} more for six months of cover`,
        action: { label: "See your cash", to: "/records" },
      });
    } else if (health.monthsCovered < 6) {
      add({
        id: "emergency-topup",
        tone: "warning",
        title: "Build your emergency money up a bit more",
        detail: `${health.monthsCovered.toFixed(1)} months of cover is a decent start. Six months is the point where losing a job or a spell in hospital would not force you to break your savings.`,
        metric: `${money(gap)} more to set aside`,
      });
    } else if (health.monthsCovered > 12) {
      add({
        id: "emergency-excess",
        tone: "opportunity",
        title: "You have more cash sitting idle than you need",
        detail: `You have about ${health.monthsCovered.toFixed(1)} months of spending in the bank. Money in a savings account grows slower than prices rise, so anything above six months of cover is quietly losing value. Put the extra to work.`,
        metric: `${money(portfolio.totals.cash - 6 * profile.monthlyExpenses)} could be doing more`,
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
        ? `${first.rate !== null ? `This one charges the most interest — ${first.rate}% a year.` : `This is your biggest one, and it does not say what interest it charges.`} Clearing the costliest loan first means you pay the least in the end. Pay the minimum on the others and put everything spare on this one.`
        : `None of your loans say what interest they charge, so we have simply put the biggest first. If you write the rate in the notes — like "@ 10.5%" — we can tell you which one is really costing you most.`,
      metric: `${money(first.amount)} left to pay`,
      action: { label: "See your loans", to: "/records" },
    });

    if (portfolio.debtRatio > 0.5) {
      add({
        id: "debt-ratio",
        tone: "critical",
        title: "You owe a lot compared to what you own",
        detail: `For every ₹100 you own, you owe ₹${(portfolio.debtRatio * 100).toFixed(0)}. At that level, one missed pay cheque is hard to absorb. Keep your emergency money topped up, then put everything spare on the loans until this comes down.`,
        metric: `You owe ${money(portfolio.liabilities)}, you own ${money(portfolio.assets)}`,
      });
    }
  }

  /* Rebalancing */
  drift
    .filter((row) => Math.abs(row.drift) >= 8 && portfolio.investableBase > 0)
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))
    .slice(0, 2)
    .forEach((row) => {
      const under = row.drift < 0;
      add({
        id: `drift-${row.key}`,
        tone: "opportunity",
        title: under
          ? `Too little of your money is in ${row.label.toLowerCase()}`
          : `Too much of your money is in ${row.label.toLowerCase()}`,
        detail: under
          ? `About ${row.target} out of every 100 rupees you save would suit someone your age. You have ${row.actual.toFixed(0)}. You do not need to sell anything — just put new money here until it evens out.`
          : `You have ${row.actual.toFixed(0)} out of every 100 rupees here, where about ${row.target} would suit someone your age. Rather than selling, put new money elsewhere until the rest catches up.`,
        metric: under ? `${money(Math.abs(row.amount))} short here` : `${money(Math.abs(row.amount))} more than needed`,
      });
    });

  /* Concentration */
  if (portfolio.largestHolding && portfolio.investableBase > 0) {
    const share = portfolio.largestHolding.amount / portfolio.investableBase;
    if (share > 0.35 && portfolio.largestHolding.bucket !== "property") {
      add({
        id: "concentration",
        tone: "warning",
        title: `Too much of your money is in one place`,
        detail: `${portfolio.largestHolding.title} holds ${(share * 100).toFixed(0)}% of your savings. If that one thing goes badly, so does most of your money. Put new savings somewhere else until no single thing holds more than about a fifth.`,
        metric: `${money(portfolio.largestHolding.amount)} in one place`,
      });
    }
  }

  /* The home you live in */
  if (portfolio.residence > 0) {
    add({
      id: "residence-noted",
      tone: "good",
      title: "Your home is counted, but left out of the advice",
      detail: `Your home is worth ${money(portfolio.residence)} and that counts towards what you are worth. But you cannot sell a piece of the house you live in, so we leave it out when we suggest where to put money. The advice above is about the ${money(portfolio.investableBase)} you can actually move.`,
    });
  } else if (portfolio.totals.property > 0) {
    add({
      id: "residence-hint",
      tone: "info",
      title: "Do you live in one of these properties?",
      detail:
        'Right now we are treating all your property as an investment, which makes it look like far too much of your money is tied up in it. If you live in one of them, write "self-occupied" in its notes. It still counts towards what you are worth, but we will stop suggesting you move money out of it.',
      action: { label: "Mark your home", to: "/records" },
    });
  }

  /* Protection */
  const annualIncome = profile.monthlyIncome * 12;
  if (portfolio.protection === 0) {
    add({
      id: "no-insurance",
      tone: profile.dependents > 0 ? "critical" : "warning",
      title: "You have not listed any insurance",
      detail: profile.dependents > 0
        ? `${profile.dependents} ${profile.dependents === 1 ? "person depends" : "people depend"} on your income. Term life insurance is the cheapest way to protect them${annualIncome > 0 ? `, and a common rule is cover worth about ten years of your income — roughly ${money(annualIncome * 10)}` : ""}. Health insurance matters just as much: one hospital stay can wipe out years of saving.`
        : "Even with nobody depending on you, health insurance protects your savings from a single hospital stay. If you already have a policy, add it here so the people you trust can find it.",
      action: { label: "Add a policy", to: "/records" },
    });
  } else if (annualIncome > 0 && portfolio.protection < annualIncome * 10) {
    add({
      id: "thin-insurance",
      tone: "warning",
      title: "Your insurance may not be enough",
      detail: `You have listed ${money(portfolio.protection)} of cover. A common rule is about ten years of your income. Life cover gets more expensive every year you wait, so it is worth checking sooner rather than later.`,
      metric: `${money(annualIncome * 10 - portfolio.protection)} below the usual rule`,
    });
  }

  /* Savings rate & investing */
  if (health.savingsRate !== null) {
    if (health.savingsRate <= 0) {
      add({
        id: "negative-savings",
        tone: "critical",
        title: "Everything you earn is going out again",
        detail: `You earn ${money(profile.monthlyIncome)} and spend ${money(profile.monthlyExpenses)}, so nothing is left over and any surprise has to go on a card or a loan. Even finding ${money(profile.monthlyIncome * 0.1)} a month — a tenth of your pay — would change things completely.`,
      });
    } else if (health.savingsRate < 0.2) {
      add({
        id: "low-savings",
        tone: "warning",
        title: "Try to keep a bit more of your pay",
        detail: `You keep ₹${(health.savingsRate * 100).toFixed(0)} out of every ₹100 you earn. Keeping ₹20 out of every ₹100 is the point where an ordinary working life pays for an ordinary retirement. Anything more buys you years of freedom.`,
        metric: `${money(profile.monthlyIncome * 0.2 - (profile.monthlyIncome - profile.monthlyExpenses))} a month more`,
      });
    } else if (plan && plan.buckets[2].amount > 0) {
      add({
        id: "invest-surplus",
        tone: "opportunity",
        title: `You have ${money(plan.buckets[2].amount)} a month to save`,
        detail: `That is what is left once your emergency money and your loans are looked after. Set up an automatic transfer on payday. Deciding once beats deciding again every month, and you will not miss what you never see.`,
        metric: `${money(plan.surplus)} spare each month`,
        action: { label: "See where to put it", to: "/advisor" },
      });
    }
  }

  /* Receivables */
  if (portfolio.totals.receivable > 0 && portfolio.investableBase > 0) {
    const share = portfolio.totals.receivable / portfolio.investableBase;
    if (share > 0.15) {
      add({
        id: "receivables",
        tone: "warning",
        title: "A lot of your money is with other people",
        detail: `${(share * 100).toFixed(0)}% of your savings is money you have lent out. It earns you nothing while it is gone, and you are relying on someone else to pay it back. Pick a date to chase the biggest one.`,
        metric: `${money(portfolio.totals.receivable)} lent out`,
        action: { label: "See who owes you", to: "/records" },
      });
    }
  }

  /* Retirement */
  if (projection) {
    if (!projection.onTrack) {
      add({
        id: "retirement-gap",
        tone: "warning",
        title: `You may not have enough saved when you stop working`,
        detail: `Saving ${money(projection.surplus)} a month, you would have about ${money(projection.projected)} by the time you are ${profile.retirementAge}. Because things cost more every year, you would need closer to ${money(projection.requiredCorpus)} to live the way you live now. Saving ${money(projection.requiredMonthly)} a month instead would get you there.`,
        metric: `${money(projection.requiredMonthly - projection.surplus)} more a month`,
        action: { label: "See the years ahead", to: "/advisor" },
      });
    } else {
      add({
        id: "retirement-ok",
        tone: "good",
        title: "You are on course for when you stop working",
        detail: `Carrying on as you are, you would have about ${money(projection.projected)} by ${profile.retirementAge}, and you would need around ${money(projection.requiredCorpus)}. Keep saving a little more each time your pay goes up and this stays true.`,
        metric: `Enough, with room to spare`,
      });
    }
  }

  /* Legacy readiness — the reason this vault exists */
  if ((contacts?.length || 0) === 0) {
    add({
      id: "no-contacts",
      tone: "critical",
      title: "Nobody would be told if something happened to you",
      detail:
        "You have not named anyone yet, so all of this would sit here unseen. Add at least two people you trust — two, so that if one cannot be reached, the other still can.",
      action: { label: "Add someone", to: "/contacts" },
    });
  } else if (contacts.length === 1) {
    add({
      id: "one-contact",
      tone: "warning",
      title: "Add one more person you trust",
      detail: "You have named one person. If they cannot be reached, nobody can. A second person — ideally living somewhere else — makes it far more likely this reaches someone.",
      action: { label: "Add someone", to: "/contacts" },
    });
  }

  if (!user?.last_message) {
    add({
      id: "no-message",
      tone: "info",
      title: "Write a message to the people you trust",
      detail: "Your list tells them what you had. A few lines in your own words tell them what you meant. It is sent along with everything else.",
      action: { label: "Write it now", to: "/profile" },
    });
  }

  if (triggerStatus && !triggerStatus.is_timer_active && !triggerStatus.is_triggered) {
    add({
      id: "timer-off",
      tone: "warning",
      title: "The safety check is switched off",
      detail: "Nothing will be sent to anyone if you go quiet, because the clock has not been started. Press the button once to switch it on.",
      action: { label: "Switch it on", to: "/trigger" },
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
