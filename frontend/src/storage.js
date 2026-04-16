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
