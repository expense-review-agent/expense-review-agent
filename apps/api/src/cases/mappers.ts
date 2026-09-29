// Prisma 資料列 → API 契約。金額由 Decimal 轉字串、日期轉 YYYY-MM-DD，不經 JS number。

import type { Prisma } from "@prisma/client";
import { REVIEW_DIMENSIONS } from "@expense-review-agent/shared";
import type {
  CheckResult,
  Finding,
  ReviewRecord,
  WorkflowActionRecord,
} from "@expense-review-agent/shared";

export const money = (value: Prisma.Decimal): string => value.toString();
export const optionalMoney = (value: Prisma.Decimal | null): string | null =>
  value === null ? null : value.toString();
/** @db.Date 欄位以 UTC 午夜儲存，取前 10 碼即為原本的日期。 */
export const isoDate = (value: Date): string => value.toISOString().slice(0, 10);

/** 取回一筆完整審查紀錄所需的關聯。 */
export const reviewInclude = {
  checks: true,
  findings: { orderBy: { orderIndex: "asc" } },
  receipts: { include: { receipt: true } },
} satisfies Prisma.ReviewRecordInclude;

type ReviewRow = Prisma.ReviewRecordGetPayload<{ include: typeof reviewInclude }>;
type FindingRow = ReviewRow["findings"][number];

/** comparison 在 DB 是 JSON；只接受 [string, string] 的陣列，其餘視為資料錯誤。 */
function comparisonOf(row: FindingRow): Array<[string, string]> {
  const value = row.comparison;
  const valid =
    Array.isArray(value) &&
    value.every(
      (pair) =>
        Array.isArray(pair) &&
        pair.length === 2 &&
        typeof pair[0] === "string" &&
        typeof pair[1] === "string",
    );
  if (!valid) throw new Error(`Finding ${row.id} 的數值對照格式錯誤`);
  return value as Array<[string, string]>;
}

export function toFinding(row: FindingRow): Finding {
  return {
    key: row.findingKey,
    dimension: row.dimension,
    kind: row.kind,
    title: row.title,
    explanation: row.explanation,
    ruleCode: row.ruleCode,
    ruleText: row.ruleText,
    comparison: comparisonOf(row),
    relatedCaseNumber: row.relatedCaseNumber,
    nextStep: row.nextStep,
  };
}

export function toReview(row: ReviewRow): ReviewRecord {
  const checks: CheckResult[] = [...row.checks]
    .sort((a, b) => REVIEW_DIMENSIONS.indexOf(a.dimension) - REVIEW_DIMENSIONS.indexOf(b.dimension))
    .map((c) => ({ dimension: c.dimension, status: c.status, summary: c.summary }));
  return {
    key: row.reviewKey,
    reviewedAt: row.reviewedAt.toISOString(),
    recommendation: row.recommendation,
    source: row.source,
    checks,
    findings: row.findings.map(toFinding),
    receiptKeys: row.receipts.map((r) => r.receipt.receiptKey).sort(),
  };
}

type ActionRow = Prisma.WorkflowActionRecordGetPayload<{ include: { review: true } }>;

export function toActionRecord(row: ActionRow): WorkflowActionRecord {
  return {
    action: row.action,
    actorType: row.actorType,
    actorLabel: row.actorLabel,
    reason: row.reason,
    originalRecommendation: row.originalRecommendation,
    reviewKey: row.review.reviewKey,
    resultingStatus: row.resultingStatus,
    createdAt: row.createdAt.toISOString(),
  };
}
