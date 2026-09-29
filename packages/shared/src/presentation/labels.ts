// =============================================================================
// 顯示文案（zh-TW）與顯示邏輯
//
// 用語依 CheckMate 的 Design System／Interaction Patterns，不自行發明狀態、建議或動作名稱。
// =============================================================================

import type { AmountCheckResult } from "../domain/amount-check.ts";
import type { CheckResultData, FindingData } from "../domain/types.ts";
import type {
  CaseStatus,
  FieldStatus,
  FindingKind,
  ReceiptField,
  Recommendation,
  ReviewDimension,
  WorkflowAction,
} from "../domain/vocabulary.ts";
import { formatCentsTwd } from "./money.ts";
import type { ProgressView } from "./workbench.ts";

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  APPROVE: "建議通過",
  REQUEST_INFO: "建議補件",
  MANUAL_REVIEW: "建議人工審核",
};

export const DIMENSION_LABEL: Record<ReviewDimension, string> = {
  EVIDENCE_MATCH: "申請與憑證核對",
  CORPORATE_POLICY: "企業規範",
  COMPLIANCE: "憑證格式（示範規則）",
  RISK_SIGNAL: "異常檢查",
};

/** 每個面向「怎麼檢查」的說明，顯示在規則依據裡。 */
export const DIMENSION_METHOD: Record<ReviewDimension, string> = {
  EVIDENCE_MATCH: "逐筆核對申報金額與對應憑證，確認必要附件。",
  CORPORATE_POLICY: "依費用類型套用企業規範與上限。",
  COMPLIANCE: "依示範格式規則確認適用門檻及統一編號欄位。",
  RISK_SIGNAL: "比對既有案件的申請人、商家、日期及金額。",
};

export const PROGRESS_LABEL: Record<ProgressView, string> = {
  PENDING: "待處理",
  AWAITING_INFO: "待補件",
  REVIEW_COMPLETED: "已完成初審",
  ALL: "全部",
};

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  PENDING: "待處理",
  AWAITING_INFO: "待補件",
  REVIEW_COMPLETED: "已完成初審",
};

/** 人工處理後在詳情顯示的結果。 */
export const ACTION_RESULT_LABEL: Record<WorkflowAction, string> = {
  PROCEED: "初審完成",
  REQUEST_INFO: "待補件",
};

export type CheckTone = "ok" | "issue" | "missing" | "unknown" | "na";

const TONE_BY_KIND: Record<FindingKind, CheckTone> = {
  MISSING: "missing",
  ANOMALY: "issue",
  UNDETERMINED: "unknown",
};

const TONE_LABEL: Record<CheckTone, string> = {
  ok: "未見異常",
  issue: "需確認",
  missing: "缺件",
  unknown: "無法判斷",
  na: "不適用",
};

export interface CheckRowView {
  tone: CheckTone;
  label: string;
  text: string;
  /** 關鍵數字，直接顯示，不用展開才看得到。 */
  figures: string | null;
  finding: FindingData | null;
}

/**
 * 檢查清單的一列。有 Finding 時依 Finding 性質決定標示，確保「已確認有問題」
 * 與「系統無法判斷」不會用同一種呈現（specs/review-case.md 4.7）。
 */
export function checkRowView(
  check: CheckResultData,
  findings: readonly FindingData[],
): CheckRowView {
  const finding = findings.find((f) => f.dimension === check.dimension) ?? null;
  const tone: CheckTone = finding
    ? TONE_BY_KIND[finding.kind]
    : check.status === "NOT_APPLICABLE"
      ? "na"
      : "ok";
  const figures =
    finding && finding.comparison.length > 0
      ? finding.comparison.map(([k, v]) => `${k} ${v}`).join("，")
      : null;
  return { tone, label: TONE_LABEL[tone], text: check.summary, figures, finding };
}

/** 建議卡片內文。 */
export function recommendationCardBody(review: {
  recommendation: Recommendation;
  findings: ReadonlyArray<Pick<FindingData, "nextStep" | "explanation">>;
}): string {
  if (review.recommendation === "APPROVE") return "資料齊全，核對無誤，可完成初審。";
  return review.findings.map((f) => f.nextStep ?? f.explanation).join(" ");
}

// ---- 單據讀取（specs/receipt-reading.md） -----------------------------------------

export const FIELD_LABEL: Record<ReceiptField, string> = {
  vendor: "供應商",
  issueDate: "開立日期",
  totalAmount: "總金額",
  currency: "幣別",
  documentNumber: "憑證號碼",
  taxId: "統一編號欄位",
};

/** 「無法辨識」與「單據上沒有此欄位」必須用不同文字（4.3）。 */
export const FIELD_STATUS_LABEL: Record<FieldStatus, string> = {
  RECOGNIZED: "已辨識",
  UNREADABLE: "無法辨識",
  NOT_ON_RECEIPT: "單據上沒有此欄位",
};

/** 以讀取金額做 E-01 比對的一句話結論，差額說明方向。 */
export function amountCheckSummary(result: AmountCheckResult): string {
  switch (result.status) {
    case "MATCH":
      return "金額一致";
    case "MISSING_EVIDENCE":
      return "缺憑證";
    case "UNDETERMINED":
      return "無法判斷";
    case "MISMATCH": {
      const diff = result.differenceCents ?? 0;
      return `申請金額比憑證${diff > 0 ? "多" : "少"} ${formatCentsTwd(diff)}`;
    }
  }
}
