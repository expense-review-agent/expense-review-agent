// =============================================================================
// 審查紀錄的領域資料形狀（純 TS，不依賴 zod，seed 可直接 import）。
// API 契約在 api.ts 以 zod 定義，形狀與這裡一致。
// =============================================================================

import type { CheckStatus, FindingKind, Recommendation, ReviewDimension } from "./vocabulary.ts";

/** 單一面向的檢核結果。每筆審查紀錄四個面向各一筆，不以沉默代表通過。 */
export interface CheckResultData {
  dimension: ReviewDimension;
  status: CheckStatus;
  /** 一句話結論，例如「申請與憑證金額一致」或「不適用：未達示範門檻」。 */
  summary: string;
}

/** 需要使用者注意的問題（specs/review-case.md 5.4）。 */
export interface FindingData {
  /** 審查紀錄內的穩定識別，用來比較兩次審查的新增與已解決問題。 */
  key: string;
  dimension: ReviewDimension;
  kind: FindingKind;
  /** 發現了什麼 */
  title: string;
  /** 為什麼重要 */
  explanation: string;
  /** 判斷依據：規則代碼（如 P-01、E-01）與條文原文。 */
  ruleCode: string | null;
  ruleText: string;
  /** 關鍵數值對照，例如 [["申請金額", "NT$1,680"], ["憑證金額", "NT$1,480"]]。 */
  comparison: Array<[string, string]>;
  /** 疑似重複時被比較的既有案件。 */
  relatedCaseNumber: string | null;
  /** 對案件下一步的影響，例如「請補充住宿憑證。」；未提供時以 explanation 說明。 */
  nextStep: string | null;
}

export interface ReviewContent {
  recommendation: Recommendation;
  checks: CheckResultData[];
  findings: FindingData[];
}
