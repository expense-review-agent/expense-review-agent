// =============================================================================
// 工作台列表的篩選與分流（interaction-patterns.md「本輪工作台操作提案」）
//
// - 案件編號與申請人條件採 AND，初審建議複選採 OR；空篩選代表全部。
// - 第一層依處理進度分流：待處理／待補件／已完成初審／全部。
// 純函式，前端直接使用，不在 web 另寫一份。
// =============================================================================

import type { CaseStatus, Recommendation } from "../domain/vocabulary.ts";

export const PROGRESS_VIEWS = ["PENDING", "AWAITING_INFO", "REVIEW_COMPLETED", "ALL"] as const;
export type ProgressView = (typeof PROGRESS_VIEWS)[number];

/** 列表篩選需要的最小欄位；API 的案件列表項目滿足這個形狀。 */
export interface WorkbenchItem {
  caseNumber: string;
  applicantName: string;
  recommendation: Recommendation;
  status: CaseStatus;
}

export function filterCases<T extends WorkbenchItem>(
  items: readonly T[],
  caseNumberQuery: string,
  applicantQuery: string,
  recommendations: readonly Recommendation[],
): T[] {
  const id = caseNumberQuery.trim().toLowerCase();
  const name = applicantQuery.trim();
  return items.filter(
    (item) =>
      item.caseNumber.toLowerCase().includes(id) &&
      item.applicantName.includes(name) &&
      (recommendations.length === 0 || recommendations.includes(item.recommendation)),
  );
}

export function filterByProgress<T extends WorkbenchItem>(
  items: readonly T[],
  view: ProgressView,
): T[] {
  return view === "ALL" ? [...items] : items.filter((item) => item.status === view);
}

export function progressCounts(items: readonly WorkbenchItem[]): Record<ProgressView, number> {
  return {
    PENDING: filterByProgress(items, "PENDING").length,
    AWAITING_INFO: filterByProgress(items, "AWAITING_INFO").length,
    REVIEW_COMPLETED: filterByProgress(items, "REVIEW_COMPLETED").length,
    ALL: items.length,
  };
}

/** 可以批次完成初審的案件：尚未處理且最新建議為建議通過。 */
export function batchEligible<T extends WorkbenchItem>(items: readonly T[]): T[] {
  return items.filter((item) => item.status === "PENDING" && item.recommendation === "APPROVE");
}

/** 列表「初審結果」欄的一句話摘要：第一個 Finding 的標題。 */
export function agentSummary(findings: ReadonlyArray<{ title: string }>): string {
  return findings[0]?.title ?? "資料齊全，核對無誤";
}
