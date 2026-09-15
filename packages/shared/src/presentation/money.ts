// =============================================================================
// 金額顯示格式化——純字串處理，不經 JS number（避免浮點誤差，CLAUDE.md）。
// 只負責顯示；不做任何換算或運算。
// =============================================================================

const DECIMAL_STRING = /^(-?)(\d+)(\.\d+)?$/;

/**
 * "12345.50", "TWD" → "NT$ 12,345.50"
 * "12000", "USD"    → "USD 12,000"
 * null              → "—"
 * 非預期格式原樣顯示（前綴幣別），不猜測。
 */
export function formatMoney(amount: string | null, currency: string): string {
  if (amount === null) return "—";
  const prefix = currency === "TWD" ? "NT$" : currency;
  const match = DECIMAL_STRING.exec(amount.trim());
  if (!match) return `${prefix} ${amount}`;
  const [, sign = "", integer = "", fraction = ""] = match;
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${prefix} ${sign}${grouped}${fraction}`;
}
