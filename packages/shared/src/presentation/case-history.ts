// =============================================================================
// 申請人／部門申請紀錄的顯示模型。
//
// 產品邊界（proposal「範圍界線」、specs/review-api）：這裡只是既有案件欄位的唯讀
// 投影。**不計算風險分數、不做頻率統計、不產生任何「此人／此部門有問題」的結論**——
// 跨案件風險判定屬 M2。這個模組刻意沒有任何聚合輸出，只有排序與「哪一筆是當前案件」。
// =============================================================================

import type { CaseHistoryItem, CaseHistoryResponse } from "../api.ts";
import { t } from "../i18n/format.ts";

export interface CaseHistoryRowView {
  id: string;
  caseNumber: string;
  /** 申請日期；未記錄時為「—」。 */
  applicationDateLabel: string;
  amountLabel: string;
  classificationLabel: string | null;
  caseStatusLabel: string;
  /** 當前開啟的那一筆（UI 需標示，且不應可點選切換到自己）。 */
  isCurrent: boolean;
}

export interface CaseHistoryView {
  /** 視窗標題，例如「王小明的申請紀錄」。 */
  title: string;
  rows: CaseHistoryRowView[];
  /** 除當前案件外沒有其他紀錄——UI 必須明示，不可顯示空白清單。 */
  hasNoOtherRecords: boolean;
}

const CLASSIFICATIONS = new Set(["NORMAL", "MISSING", "EXCEPTION", "HUMAN"]);

/** 依申請日期由新到舊；缺日期的排末尾，同日期以案件編號穩定排序。 */
function byApplicationDateDesc(a: CaseHistoryItem, b: CaseHistoryItem): number {
  if (a.applicationDate === null && b.applicationDate === null) {
    return a.caseNumber.localeCompare(b.caseNumber);
  }
  if (a.applicationDate === null) return 1;
  if (b.applicationDate === null) return -1;
  const cmp = b.applicationDate.localeCompare(a.applicationDate);
  return cmp !== 0 ? cmp : a.caseNumber.localeCompare(b.caseNumber);
}

export function buildCaseHistoryView(
  response: CaseHistoryResponse,
  formatAmount: (amount: string | null, currency: string) => string,
): CaseHistoryView {
  const sorted = [...response.items].sort(byApplicationDateDesc);
  const rows: CaseHistoryRowView[] = sorted.map((entry) => ({
    id: entry.id,
    caseNumber: entry.caseNumber,
    applicationDateLabel: entry.applicationDate ?? "—",
    amountLabel: formatAmount(entry.amount, entry.currency),
    // status 欄位可能是 Agent 分類或流程狀態（無 run 的案件）；只有分類才顯示徽章。
    classificationLabel: CLASSIFICATIONS.has(entry.status)
      ? t(`classification.${entry.status}`)
      : null,
    caseStatusLabel: t(`caseStatus.${entry.caseStatus}`),
    isCurrent: entry.isCurrent,
  }));

  return {
    title: t(`caseHistory.title.${response.scope}`, { subject: response.subject }),
    rows,
    hasNoOtherRecords: rows.filter((row) => !row.isCurrent).length === 0,
  };
}
