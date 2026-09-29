// =============================================================================
// Demo 案例的一致性檢查
//
// 預置的審查結果不是引擎算出來的，所以要在寫入前證明它們沒有自相矛盾：
//   1. 符合 shared 的產品規則（四個面向各一筆檢核、Finding 與檢核對應、
//      建議可由 Finding 推導，specs/review-case.md 4.9）。
//   2. 「申請與憑證核對」與實際的 E-01 金額比對結果一致——這是本輪唯一
//      已定案、有真實邏輯的檢查（specs/amount-check.md）。
//   3. 參照完整：憑證、明細、審查紀錄彼此對得上，明細加總等於申請金額。
// =============================================================================

import { checkAmount } from "../../../../packages/shared/src/domain/amount-check.ts";
import { reviewConsistencyProblems } from "../../../../packages/shared/src/domain/recommendation.ts";
import { sumAmounts } from "../../../../packages/shared/src/presentation/money.ts";
import type { CaseFixture, ReviewFixture } from "./fixtures.ts";

/** 依 E-01 逐筆核對明細金額與「當次審查時」已提供的對應憑證。 */
function amountCheckProblems(c: CaseFixture, review: ReviewFixture): string[] {
  const problems: string[] = [];
  const available = new Set(review.receiptKeys);
  const results = c.lines.map((line) => {
    const receipts = c.receipts.filter(
      (r) => line.receiptKeys.includes(r.key) && available.has(r.key),
    );
    return checkAmount(
      line.amount,
      receipts.length > 0,
      receipts.length > 0 ? sumAmounts(receipts.map((r) => r.amount)) : "",
    );
  });

  const evidenceFindings = review.findings.filter((f) => f.dimension === "EVIDENCE_MATCH");
  const evidenceCheck = review.checks.find((ch) => ch.dimension === "EVIDENCE_MATCH");

  if (results.some((r) => r.status === "MISSING_EVIDENCE")) {
    if (!evidenceFindings.some((f) => f.kind === "MISSING")) {
      problems.push("E-01 判定缺憑證，但沒有「缺漏」Finding");
    }
  }
  if (results.some((r) => r.status === "MISMATCH" || r.status === "UNDETERMINED")) {
    if (!evidenceFindings.some((f) => f.kind === "ANOMALY" || f.kind === "UNDETERMINED")) {
      problems.push("E-01 判定金額不一致或無法判斷，但沒有對應 Finding");
    }
  }
  if (results.every((r) => r.status === "MATCH") && evidenceCheck?.status !== "PASS") {
    problems.push(`E-01 判定金額一致，但申請與憑證核對為 ${evidenceCheck?.status ?? "缺漏"}`);
  }
  return problems;
}

function referenceProblems(c: CaseFixture): string[] {
  const problems: string[] = [];
  const receiptKeys = new Set(c.receipts.map((r) => r.key));
  for (const line of c.lines) {
    for (const key of line.receiptKeys) {
      if (!receiptKeys.has(key)) problems.push(`明細 ${line.key} 指向不存在的憑證 ${key}`);
    }
  }
  for (const review of c.reviews) {
    for (const key of review.receiptKeys) {
      if (!receiptKeys.has(key)) problems.push(`${review.key} 指向不存在的憑證 ${key}`);
    }
  }
  const linesTotal = sumAmounts(c.lines.map((l) => l.amount));
  if (linesTotal !== sumAmounts([c.amount])) {
    problems.push(`明細加總 ${linesTotal} 不等於申請金額 ${c.amount}`);
  }
  const times = c.reviews.map((r) => r.reviewedAt);
  if (times.some((t, i) => i > 0 && t < times[i - 1]!)) {
    problems.push("審查紀錄必須由舊到新排列");
  }
  return problems;
}

/** 回傳所有問題；空陣列代表全部案例可以寫入。 */
export function validateFixtures(cases: readonly CaseFixture[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const c of cases) {
    for (const key of [
      c.caseNumber,
      ...c.reviews.map((r) => r.key),
      ...c.receipts.map((r) => r.key),
    ]) {
      if (seen.has(key)) problems.push(`識別碼重複：${key}`);
      seen.add(key);
    }
    problems.push(...referenceProblems(c).map((p) => `${c.caseNumber}：${p}`));
    for (const review of c.reviews) {
      const found = [...reviewConsistencyProblems(review), ...amountCheckProblems(c, review)];
      problems.push(...found.map((p) => `${c.caseNumber} ${review.key}：${p}`));
    }
  }
  return problems;
}
