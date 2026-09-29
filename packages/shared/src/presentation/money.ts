// =============================================================================
// 金額顯示與加總（新台幣）
//
// API 以字串傳遞金額（後端由 Prisma Decimal 轉字串）。這裡一律以 BigInt 的「分」
// 計算與格式化，不經 JS number，避免浮點誤差。
// =============================================================================

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

function parseCents(raw: string): bigint | undefined {
  const value = raw.trim();
  if (!AMOUNT_PATTERN.test(value)) return undefined;
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "1480" → "NT$1,480"；"1480.5" → "NT$1,480.50"。無法解析時原樣回傳，不猜測。 */
export function formatTwd(amount: string): string {
  const cents = parseCents(amount);
  if (cents === undefined) return amount;
  const whole = groupThousands((cents / 100n).toString());
  const fraction = cents % 100n;
  return fraction === 0n ? `NT$${whole}` : `NT$${whole}.${fraction.toString().padStart(2, "0")}`;
}

/** 加總金額字串，回傳兩位小數的字串。遇到無法解析的金額直接丟錯，不略過。 */
export function sumAmounts(amounts: readonly string[]): string {
  let total = 0n;
  for (const amount of amounts) {
    const cents = parseCents(amount);
    if (cents === undefined) throw new Error(`無法解析的金額：${amount}`);
    total += cents;
  }
  return `${total / 100n}.${(total % 100n).toString().padStart(2, "0")}`;
}
