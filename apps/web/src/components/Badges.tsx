import { t } from "@expense-review-agent/shared/browser";
import type {
  CaseStatus,
  Classification,
  ConsistencyFlag,
  RecommendedAction,
} from "@expense-review-agent/shared/browser";

const CLASSIFICATIONS: readonly string[] = ["NORMAL", "MISSING", "EXCEPTION", "HUMAN"];

export function isClassification(value: string): value is Classification {
  return CLASSIFICATIONS.includes(value);
}

/** Agent 四分類徽章。沒有分類（無 run 的案件）時顯示灰色的流程狀態。 */
export function ClassificationBadge({ value }: { value: Classification | CaseStatus }) {
  const known = isClassification(value);
  return (
    <span className={`badge badge--${known ? value : "NONE"}`}>
      <span className="badge__dot" aria-hidden="true" />
      {known ? t(`classification.${value}`) : t(`caseStatus.${value}`)}
    </span>
  );
}

export function RecommendationTag({ value }: { value: RecommendedAction | null }) {
  if (!value) return <span className="act act--NONE">—</span>;
  return <span className={`act act--${value}`}>{t(`recommendedAction.${value}`)}</span>;
}

/** 案件流程狀態（待審／待補件／已處置…），與分類徽章分開呈現。 */
export function CaseStatusTag({ value }: { value: CaseStatus }) {
  return <span className={`status status--${value}`}>{t(`caseStatus.${value}`)}</span>;
}

/** 一致性徽章：只接受後端回傳的固化值，UI 不重算。 */
export function ConsistencyFlagBadge({ value }: { value: ConsistencyFlag }) {
  return <span className={`flag flag--${value}`}>{t(`consistencyFlag.${value}`)}</span>;
}
