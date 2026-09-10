const USER_KEY = "death_note_user";

export function getStoredUser() {
  const saved = localStorage.getItem(USER_KEY);
  return saved ? JSON.parse(saved) : null;
}

export function clearAllSessionData() {
  const keysToKeep = []; // Keep nothing for a full logout/cleanup
  const legacyKeys = [
    "digital_legacy_sensitive_data",
    "digital_legacy_user",
    "dls_records",
    "dls_user",
    "token",
    "user",
    "death_note_user",
    "access_token",
    "refresh_token"
  ];

  legacyKeys.forEach(key => localStorage.removeItem(key));
}

export function setStoredUser(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

export function formatServerDate(value) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(parsed);
}

export function safeAmount(value) {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function currencyTotal(records) {
  return records.reduce((sum, item) => sum + safeAmount(item.amount), 0);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safeAmount(value));
}

export function calculateBuckets(records) {
  return records.reduce(
    (acc, item) => {
      const amount = safeAmount(item.amount);
      const category = (item.category || "Other").toLowerCase();

      if (["debt", "bill"].includes(category)) {
        acc.debt += amount;
      } else if (["money owed to me", "lent", "owed", "receivable"].includes(category)) {
        acc.lent += amount;
      } else {
        acc.assets += amount;
      }

      return acc;
    },
    { debt: 0, lent: 0, assets: 0 },
  );
}

export function getDashboardInsights(records) {
  let highestDebt = null;
  let highestOwed = null;
  let strongestAsset = null;

  records.forEach((item) => {
    const amount = safeAmount(item.amount);
    const category = (item.category || "Other").toLowerCase();

    if (["debt", "bill"].includes(category)) {
      if (!highestDebt || amount > safeAmount(highestDebt.amount)) highestDebt = item;
    } else if (["money owed to me", "lent", "owed", "receivable"].includes(category)) {
      if (!highestOwed || amount > safeAmount(highestOwed.amount)) highestOwed = item;
    } else {
      if (!strongestAsset || amount > safeAmount(strongestAsset.amount)) strongestAsset = item;
    }
  });

  return { highestDebt, highestOwed, strongestAsset };
}

export function formatDuration(seconds) {
  if (seconds === undefined || seconds === null) return "--";
  if (seconds <= 0) return "0s";

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  // If we have days, only show days & hours for clean display.
  // Otherwise, show hours & minutes, or minutes & seconds.
  return parts.slice(0, 2).join(" ");
}

export function formatThreshold(seconds) {
  if (seconds === undefined || seconds === null) return "--";
  const days = seconds / 86400;
  if (days === 90) return "3 months";
  if (days === 60) return "2 months";
  if (days === 30) return "1 month";
  if (days >= 1 && days % 1 === 0) return `${days} days`;
  return `${seconds}s`;
}


/* ------------------------------------------------------------------ *
 * Financial profile — the inputs the advisor needs that the vault does
 * not already hold. Kept per account in this browser only; it never
 * leaves the device and is not part of the legacy report.
 * ------------------------------------------------------------------ */

const PROFILE_KEY = "quiet_record_financial_profile";

export function getFinancialProfile(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    return saved[String(userId)] || null;
  } catch {
    return null;
  }
}

export function setFinancialProfile(userId, profile) {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    saved[String(userId)] = profile;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(saved));
  } catch {
    /* storage unavailable (private window, blocked cookies) — the advisor
       still works, the profile just does not persist between visits. */
  }
}

const trim = (text) => text.replace(/\.0$/, "");

/** Short form for chart axes and dense tables: ₹1.2 Cr, ₹4.5 L, ₹12 K. */
export function formatCompactCurrency(value) {
  const amount = safeAmount(value);
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);

  if (abs >= 1e7) return `${sign}₹${trim((abs / 1e7).toFixed(abs >= 1e8 ? 0 : 1))} Cr`;
  if (abs >= 1e5) return `${sign}₹${trim((abs / 1e5).toFixed(abs >= 1e6 ? 0 : 1))} L`;
  if (abs >= 1e3) return `${sign}₹${Math.round(abs / 1e3)} K`;
  return `${sign}₹${Math.round(abs)}`;
}

export function formatPercent(value, digits = 0) {
  return `${safeAmount(value).toFixed(digits)}%`;
}
