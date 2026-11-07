/** Latin digits → Bangla digits for counts when lang=bn. */
export function toBnDigits(
  value: number | string,
  lang: "en" | "bn"
): string {
  if (lang !== "bn") return String(value);
  const bn = "০১২৩৪৫৬৭৮৯";
  return String(value).replace(/\d/g, (d) => bn[Number(d)]);
}

/**
 * Grouped integer amount in the platform currency (BDT).
 * bn mode shows Bangla numerals — matches the Midman design language.
 */
export function formatAmount(
  amount: number,
  lang: "en" | "bn",
  options?: { withSymbol?: boolean }
): string {
  const grouped = new Intl.NumberFormat("en-US").format(Math.round(amount));
  const digits = toBnDigits(grouped, lang);
  return options?.withSymbol === false ? digits : `৳${digits}`;
}

/** Deal code rendering — stays Latin (technical identifier). */
export function formatDealCode(code: string, _lang: "en" | "bn"): string {
  return code;
}

/**
 * Human date, e.g. "07 Nov 2026" / "০৭ নভেম্বর ২০২৬".
 * The DB stores unix timestamps (UTC); display resolves to Asia/Dhaka.
 */
export function formatDate(
  value: number | Date | null | undefined,
  lang: "en" | "bn"
): string {
  if (value === null || value === undefined) return "—";
  const date = typeof value === "number" ? new Date(value * 1000) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const dtf = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });
  return dtf.format(date);
}

/** Date + time, e.g. "07 Nov 2026, 14:05" / Bangla equivalent. */
export function formatDateTime(
  value: number | Date | null | undefined,
  lang: "en" | "bn"
): string {
  if (value === null || value === undefined) return "—";
  const date = typeof value === "number" ? new Date(value * 1000) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const dtf = new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  });
  return dtf.format(date);
}

/** Percentage with a minimum of one decimal for small values. */
export function formatPercent(fraction: number, lang: "en" | "bn"): string {
  const pct = fraction * 100;
  const text =
    pct > 0 && pct < 1 ? pct.toFixed(2) : Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
  return `${toBnDigits(text, lang)}%`;
}
