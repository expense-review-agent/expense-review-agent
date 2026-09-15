import type { CaseListItem, Classification } from "@expense-review-agent/shared/browser";

export const QUEUE_CLASSIFICATIONS: readonly Classification[] = [
  "NORMAL",
  "MISSING",
  "EXCEPTION",
  "HUMAN",
];

export type ClassificationFilter = Classification | "ALL";

/** 預設佇列：排除已結案的參照案件（REVIEW_CLOSED）。 */
export function queueItems(items: readonly CaseListItem[]): CaseListItem[] {
  return items.filter((item) => item.caseStatus !== "REVIEW_CLOSED");
}

/**
 * 四分類計數，由「同一份」預設佇列計算，卡片、chip、列表三者必然一致。
 * 不用 /cases/summary：它會把帶 run 的已結案參照案件算進分類。
 */
export function classificationCounts(items: readonly CaseListItem[]) {
  const counts = Object.fromEntries(QUEUE_CLASSIFICATIONS.map((c) => [c, 0])) as Record<
    Classification,
    number
  >;
  for (const item of items) {
    if (item.status in counts) counts[item.status as Classification] += 1;
  }
  const total = QUEUE_CLASSIFICATIONS.reduce((sum, c) => sum + counts[c], 0);
  return { counts, total };
}
