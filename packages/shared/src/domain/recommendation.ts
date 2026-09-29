// =============================================================================
// 審查建議推導與審查紀錄一致性（specs/review-case.md 5.3–5.5）
//
// 推導原則（依優先序）：
//   1. 有明確異常或系統無法判斷 → 建議人工審核
//   2. 否則有可補正的缺漏 → 建議補件
//   3. 否則 → 建議通過
// 補件與人工審核條件並存時，人工審核優先。
// =============================================================================

import type { FindingData, ReviewContent } from "./types.ts";
import { REVIEW_DIMENSIONS } from "./vocabulary.ts";
import type { Recommendation } from "./vocabulary.ts";

export function deriveRecommendation(
  findings: ReadonlyArray<Pick<FindingData, "kind">>,
): Recommendation {
  if (findings.some((f) => f.kind === "ANOMALY" || f.kind === "UNDETERMINED")) {
    return "MANUAL_REVIEW";
  }
  if (findings.some((f) => f.kind === "MISSING")) return "REQUEST_INFO";
  return "APPROVE";
}

/**
 * 檢查一筆審查紀錄是否自洽；回傳問題描述，空陣列代表一致。
 *
 * 用途：預置的模擬審查結果在寫入前都要通過這個檢查（seed），確保所有案例
 * 使用同一套產品模型與規則（4.9），不為個別案例寫出彼此矛盾的資料。
 */
export function reviewConsistencyProblems(review: ReviewContent): string[] {
  const problems: string[] = [];

  for (const dimension of REVIEW_DIMENSIONS) {
    const checks = review.checks.filter((c) => c.dimension === dimension);
    if (checks.length !== 1) {
      problems.push(`${dimension} 應恰好有一筆檢核結果，實際 ${checks.length} 筆`);
      continue;
    }
    const check = checks[0]!;
    const findings = review.findings.filter((f) => f.dimension === dimension);

    if ((check.status === "FAIL" || check.status === "UNDETERMINED") && findings.length === 0) {
      problems.push(`${dimension} 為 ${check.status}，但沒有對應的 Finding`);
    }
    if ((check.status === "PASS" || check.status === "NOT_APPLICABLE") && findings.length > 0) {
      problems.push(`${dimension} 有 Finding，檢核結果卻是 ${check.status}`);
    }
    const hasUndetermined = findings.some((f) => f.kind === "UNDETERMINED");
    if (hasUndetermined !== (check.status === "UNDETERMINED") && findings.length > 0) {
      problems.push(
        `${dimension} 的「無法判斷」必須與檢核結果 UNDETERMINED 對應，實際為 ${check.status}`,
      );
    }
  }

  for (const f of review.findings) {
    if (!f.ruleText.trim()) problems.push(`Finding ${f.key} 缺少判斷依據`);
  }

  const derived = deriveRecommendation(review.findings);
  if (derived !== review.recommendation) {
    problems.push(`審查建議為 ${review.recommendation}，依 Finding 推導應為 ${derived}`);
  }

  return problems;
}
