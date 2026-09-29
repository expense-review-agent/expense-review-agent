// =============================================================================
// 重新審查的差異摘要（specs/review-case.md 4.8、5.7）
//
// 比較最新與前一次審查紀錄：建議是否改變、新增的問題、已解決（不再出現）的問題。
// 以 Finding 的 key 判斷是否為同一問題。差異只用於快速理解，不取代完整歷史紀錄。
// =============================================================================

import type { Recommendation } from "./vocabulary.ts";

interface DiffFinding {
  key: string;
  title: string;
}

interface DiffReview {
  recommendation: Recommendation;
  findings: readonly DiffFinding[];
}

export interface ReviewDiff {
  previousRecommendation: Recommendation;
  currentRecommendation: Recommendation;
  recommendationChanged: boolean;
  added: DiffFinding[];
  resolved: DiffFinding[];
}

/** 審查紀錄依時間由舊到新排列；少於兩筆時回傳 null。 */
export function diffReviews(reviews: readonly DiffReview[]): ReviewDiff | null {
  if (reviews.length < 2) return null;
  const previous = reviews[reviews.length - 2]!;
  const current = reviews[reviews.length - 1]!;
  const previousKeys = new Set(previous.findings.map((f) => f.key));
  const currentKeys = new Set(current.findings.map((f) => f.key));
  const pick = ({ key, title }: DiffFinding) => ({ key, title });
  return {
    previousRecommendation: previous.recommendation,
    currentRecommendation: current.recommendation,
    recommendationChanged: previous.recommendation !== current.recommendation,
    added: current.findings.filter((f) => !previousKeys.has(f.key)).map(pick),
    resolved: previous.findings.filter((f) => !currentKeys.has(f.key)).map(pick),
  };
}
