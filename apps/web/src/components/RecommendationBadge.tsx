import { RECOMMENDATION_LABEL, RECOMMENDATIONS } from "@expense-review-agent/shared/browser";
import type { Recommendation } from "@expense-review-agent/shared/browser";

/** tone-0 建議通過、tone-1 建議補件、tone-2 建議人工審核。文字標籤一併顯示，不只靠顏色。 */
export const toneOf = (value: Recommendation) => `tone-${RECOMMENDATIONS.indexOf(value)}`;

export function RecommendationBadge({ value }: { value: Recommendation }) {
  return (
    <span className={`badge ${toneOf(value)}`}>
      <span />
      {RECOMMENDATION_LABEL[value]}
    </span>
  );
}
