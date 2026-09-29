// =============================================================================
// E-01 v1 金額比對（specs/amount-check.md）
//
// 以最小貨幣單位（分）比較，不設誤差容許。缺憑證與「有憑證但金額未填」分開：
// 前者是可補正的缺件，後者是無法判斷，都不得當成金額為零。
// 移植自 CheckMate 的 src/features/review/amount-check.ts，行為一致。
// =============================================================================

export const AMOUNT_CHECK_RULE = "E-01 v1" as const;

export type AmountCheckStatus = "MATCH" | "MISMATCH" | "MISSING_EVIDENCE" | "UNDETERMINED";

export interface AmountCheckResult {
  status: AmountCheckStatus;
  reason: string;
  applicationCents?: number;
  evidenceCents?: number;
  /** 申請金額減憑證金額，有方向；正數代表申請比憑證多。 */
  differenceCents?: number;
  rule: typeof AMOUNT_CHECK_RULE;
}

/** 非負、最多兩位小數、在安全整數範圍內的金額字串 → 分；其餘一律 undefined。 */
export function toCents(raw: string): number | undefined {
  const value = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return undefined;
  const [whole = "", fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : undefined;
}

export function checkAmount(
  application: string,
  attached: boolean,
  evidence: string,
): AmountCheckResult {
  const applicationCents = toCents(application);
  const base = { rule: AMOUNT_CHECK_RULE };
  if (applicationCents === undefined) {
    return {
      ...base,
      status: "UNDETERMINED",
      reason: "申請金額須為非負數，最多兩位小數，且不得超出可處理範圍。",
    };
  }
  if (!attached) {
    return {
      ...base,
      applicationCents,
      status: "MISSING_EVIDENCE",
      reason: "未附憑證，請補充後再核對金額。",
    };
  }
  const evidenceCents = toCents(evidence);
  if (evidenceCents === undefined) {
    return {
      ...base,
      applicationCents,
      status: "UNDETERMINED",
      reason: "憑證總額未填或格式無效，請確認憑證金額。",
    };
  }
  const differenceCents = applicationCents - evidenceCents;
  return {
    ...base,
    applicationCents,
    evidenceCents,
    differenceCents,
    status: differenceCents === 0 ? "MATCH" : "MISMATCH",
    reason:
      differenceCents === 0
        ? "本項金額一致；尚未執行企業規範、憑證格式與重複申報檢查。"
        : "金額有差異，需由財務人員確認原因。",
  };
}
