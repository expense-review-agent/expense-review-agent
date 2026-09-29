// =============================================================================
// 單據讀取結果的規則（specs/receipt-reading.md）
//
// AI 只負責「讀」；這裡負責兩件事：
//   1. 擷取結果本身是否合乎規則——不合就整次作廢（4.8），不採用部分結果。
//   2. 把讀到的金額交給 E-01 比對；讀不到、沒把握的地方一律是「無法判斷」，
//      不當成零元，也不當成缺憑證（4.6）。
// =============================================================================

import { checkAmount, toCents, AMOUNT_CHECK_RULE } from "./amount-check.ts";
import type { AmountCheckResult } from "./amount-check.ts";
import { RECEIPT_FIELDS } from "./vocabulary.ts";
import type { FieldStatus, ReceiptField } from "./vocabulary.ts";

export interface ExtractedField {
  status: FieldStatus;
  /** 只有 RECOGNIZED 時有值；其餘一律為 null，不帶猜測值。 */
  value: string | null;
}

export type ReceiptExtraction = Record<ReceiptField, ExtractedField>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** 擷取結果的格式問題；空陣列代表可以採用。 */
export function extractionProblems(extraction: ReceiptExtraction): string[] {
  const problems: string[] = [];
  for (const field of RECEIPT_FIELDS) {
    const { status, value } = extraction[field];
    if (status === "RECOGNIZED") {
      if (value === null || !value.trim()) problems.push(`${field} 標示已辨識卻沒有值`);
    } else if (value !== null) {
      problems.push(`${field} 標示 ${status} 卻帶有值`);
    }
  }
  const amount = extraction.totalAmount;
  if (
    amount.status === "RECOGNIZED" &&
    amount.value !== null &&
    toCents(amount.value) === undefined
  ) {
    problems.push(`totalAmount 不是有效金額：${amount.value}`);
  }
  const date = extraction.issueDate;
  if (date.status === "RECOGNIZED" && date.value !== null && !isValidDate(date.value)) {
    problems.push(`issueDate 不是有效日期：${date.value}`);
  }
  return problems;
}

export interface LineForReading {
  key: string;
  amount: string;
  receiptKeys: readonly string[];
}

export interface LineAmountCheck {
  lineKey: string;
  result: AmountCheckResult;
}

function undetermined(line: LineForReading, reason: string): AmountCheckResult {
  const applicationCents = toCents(line.amount);
  return {
    rule: AMOUNT_CHECK_RULE,
    status: "UNDETERMINED",
    reason,
    ...(applicationCents === undefined ? {} : { applicationCents }),
  };
}

/** 讀不到可用金額的原因；可用時回傳 null。 */
function unusableReason(
  receiptKey: string,
  extraction: ReceiptExtraction | undefined,
): string | null {
  if (!extraction) return `憑證 ${receiptKey} 沒有讀取結果，無法比對金額。`;
  const { totalAmount, currency } = extraction;
  if (totalAmount.status === "UNREADABLE") return `憑證 ${receiptKey} 的金額無法辨識，請人工確認。`;
  if (totalAmount.status === "NOT_ON_RECEIPT") return `憑證 ${receiptKey} 上沒有金額，請人工確認。`;
  if (currency.status !== "RECOGNIZED") {
    return `憑證 ${receiptKey} 的幣別無法確認為新台幣，請人工確認。`;
  }
  if (currency.value !== "TWD") {
    return `憑證 ${receiptKey} 的幣別為 ${currency.value}，本輪只支援新台幣。`;
  }
  return null;
}

/**
 * 以讀取結果逐筆明細執行 E-01（多張憑證先加總）。
 * 明細沒有對應憑證 → 缺憑證；任一張對應憑證讀不到可用金額 → 無法判斷。
 */
export function amountChecksForReading(
  lines: readonly LineForReading[],
  extractions: ReadonlyMap<string, ReceiptExtraction>,
): LineAmountCheck[] {
  return lines.map((line) => {
    if (line.receiptKeys.length === 0) {
      return { lineKey: line.key, result: checkAmount(line.amount, false, "") };
    }
    for (const key of line.receiptKeys) {
      const reason = unusableReason(key, extractions.get(key));
      if (reason) return { lineKey: line.key, result: undetermined(line, reason) };
    }
    let totalCents = 0;
    for (const key of line.receiptKeys) {
      totalCents += toCents(extractions.get(key)!.totalAmount.value!)!;
    }
    const evidence = `${Math.trunc(totalCents / 100)}.${String(totalCents % 100).padStart(2, "0")}`;
    return { lineKey: line.key, result: checkAmount(line.amount, true, evidence) };
  });
}
