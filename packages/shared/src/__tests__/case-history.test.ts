// 申請紀錄顯示模型測試——排序、當前案件標示，以及「不得出現風險判定」的邊界。

import { test } from "node:test";
import assert from "node:assert/strict";

import type { CaseHistoryItem, CaseHistoryResponse } from "../api.ts";
import { buildCaseHistoryView } from "../presentation/case-history.ts";
import { formatMoney } from "../presentation/money.ts";

function entry(
  over: Partial<CaseHistoryItem> & Pick<CaseHistoryItem, "caseNumber">,
): CaseHistoryItem {
  return {
    id: over.caseNumber,
    caseNumber: over.caseNumber,
    applicationDate: "2026-08-12",
    amount: "1200",
    currency: "TWD",
    status: "NORMAL",
    caseStatus: "DISPOSED",
    isCurrent: false,
    ...over,
  };
}

function response(
  items: CaseHistoryItem[],
  over: Partial<CaseHistoryResponse> = {},
): CaseHistoryResponse {
  return { scope: "applicant", subject: "王小明", items, ...over };
}

test("rows are ordered newest application date first", () => {
  const view = buildCaseHistoryView(
    response([
      entry({ caseNumber: "B", applicationDate: "2026-08-01" }),
      entry({ caseNumber: "C", applicationDate: "2026-08-25" }),
      entry({ caseNumber: "A", applicationDate: "2026-08-12" }),
    ]),
    formatMoney,
  );
  assert.deepEqual(
    view.rows.map((r) => r.caseNumber),
    ["C", "A", "B"],
  );
});

test("missing application dates go last and render as a dash", () => {
  const view = buildCaseHistoryView(
    response([
      entry({ caseNumber: "A", applicationDate: null }),
      entry({ caseNumber: "B", applicationDate: "2026-08-01" }),
    ]),
    formatMoney,
  );
  assert.deepEqual(
    view.rows.map((r) => r.caseNumber),
    ["B", "A"],
  );
  assert.equal(view.rows[1]?.applicationDateLabel, "—");
});

test("the starting case is included and flagged", () => {
  const view = buildCaseHistoryView(
    response([
      entry({ caseNumber: "EXP-2026-2002", isCurrent: true }),
      entry({ caseNumber: "EXP-2026-2001" }),
    ]),
    formatMoney,
  );
  const current = view.rows.filter((r) => r.isCurrent);
  assert.equal(current.length, 1);
  assert.equal(current[0]?.caseNumber, "EXP-2026-2002");
  assert.equal(view.hasNoOtherRecords, false);
});

test("a lone current case counts as having no other records", () => {
  const view = buildCaseHistoryView(
    response([entry({ caseNumber: "EXP-2026-2004", isCurrent: true })]),
    formatMoney,
  );
  assert.equal(view.rows.length, 1);
  assert.ok(view.hasNoOtherRecords, "只有起點案件時必須明示沒有其他紀錄");
});

test("classification badge only shows for real classifications", () => {
  const view = buildCaseHistoryView(
    response([
      entry({ caseNumber: "A", status: "EXCEPTION" }),
      // 無 run 的案件，status 退回流程狀態，不該被當成分類徽章
      entry({ caseNumber: "B", status: "REVIEW_CLOSED" }),
    ]),
    formatMoney,
  );
  assert.equal(view.rows[0]?.classificationLabel, "EXCEPTION");
  assert.equal(view.rows[1]?.classificationLabel, null);
});

test("titles are scope-specific and interpolate the subject", () => {
  const applicant = buildCaseHistoryView(response([entry({ caseNumber: "A" })]), formatMoney);
  assert.ok(applicant.title.includes("王小明"));
  const department = buildCaseHistoryView(
    response([entry({ caseNumber: "A" })], { scope: "department", subject: "業務部" }),
    formatMoney,
  );
  assert.ok(department.title.includes("業務部"));
  assert.notEqual(applicant.title, department.title);
});

test("the view exposes no risk score, frequency or verdict field", () => {
  const view = buildCaseHistoryView(
    response([entry({ caseNumber: "A" }), entry({ caseNumber: "B" }), entry({ caseNumber: "C" })]),
    formatMoney,
  );
  // 產品邊界：跨案件風險判定屬 M2，這個視圖不得提供任何聚合結論。
  const allowedRowKeys = [
    "id",
    "caseNumber",
    "applicationDateLabel",
    "amountLabel",
    "classificationLabel",
    "caseStatusLabel",
    "isCurrent",
  ];
  assert.deepEqual(Object.keys(view.rows[0] ?? {}).sort(), [...allowedRowKeys].sort());
  assert.deepEqual(Object.keys(view).sort(), ["hasNoOtherRecords", "rows", "title"]);
});

test("amounts are formatted through the shared money helper, never converted", () => {
  const view = buildCaseHistoryView(
    response([
      entry({ caseNumber: "A", amount: "12345.50", currency: "TWD" }),
      entry({ caseNumber: "B", amount: "800", currency: "USD", applicationDate: "2026-08-01" }),
      entry({ caseNumber: "C", amount: null, applicationDate: "2026-07-01" }),
    ]),
    formatMoney,
  );
  assert.equal(view.rows[0]?.amountLabel, "NT$ 12,345.50");
  assert.equal(view.rows[1]?.amountLabel, "USD 800");
  assert.equal(view.rows[2]?.amountLabel, "—");
});
