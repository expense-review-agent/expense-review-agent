// 工作台列表：搜尋、建議篩選、處理進度分流、摘要文字。
// 規則見 interaction-patterns.md「本輪工作台操作提案」；案例移植自 CheckMate 的 workbench.test.ts。

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  agentSummary,
  batchEligible,
  filterByProgress,
  filterCases,
  progressCounts,
} from "../presentation/workbench.ts";
import type { WorkbenchItem } from "../presentation/workbench.ts";

const item = (
  caseNumber: string,
  applicantName: string,
  recommendation: WorkbenchItem["recommendation"],
  status: WorkbenchItem["status"] = "PENDING",
): WorkbenchItem => ({ caseNumber, applicantName, recommendation, status });

const items = [
  item("EXP-2026-001", "陳怡安", "APPROVE"),
  item("EXP-2026-002", "林子晴", "REQUEST_INFO"),
  item("EXP-2026-003", "王柏翰", "MANUAL_REVIEW"),
  item("EXP-2026-008", "林子晴", "REQUEST_INFO"),
];

test("編號與姓名使用 AND，複選建議使用 OR，且忽略搜尋前後空白", () => {
  assert.deepEqual(
    filterCases(items, " 002 ", " 林 ", ["REQUEST_INFO", "APPROVE"]).map((c) => c.caseNumber),
    ["EXP-2026-002"],
  );
  assert.deepEqual(filterCases(items, "002", "王", []), []);
  assert.equal(filterCases(items, "", "", ["REQUEST_INFO", "APPROVE"]).length, 3);
});

test("案件編號搜尋不分大小寫", () => {
  assert.equal(filterCases(items, "exp-2026-003", "", []).length, 1);
});

test("空篩選顯示所有案件", () => {
  assert.equal(filterCases(items, "", "", []).length, items.length);
});

test("完成及退回案件移出待處理，等待補件不算已完成", () => {
  const handled = [
    item("EXP-2026-001", "陳怡安", "APPROVE", "REVIEW_COMPLETED"),
    item("EXP-2026-002", "林子晴", "REQUEST_INFO", "AWAITING_INFO"),
    item("EXP-2026-003", "王柏翰", "MANUAL_REVIEW"),
  ];
  assert.deepEqual(
    filterByProgress(handled, "PENDING").map((c) => c.caseNumber),
    ["EXP-2026-003"],
  );
  assert.deepEqual(
    filterByProgress(handled, "AWAITING_INFO").map((c) => c.caseNumber),
    ["EXP-2026-002"],
  );
  assert.deepEqual(
    filterByProgress(handled, "REVIEW_COMPLETED").map((c) => c.caseNumber),
    ["EXP-2026-001"],
  );
  assert.equal(filterByProgress(handled, "ALL").length, 3);
  assert.deepEqual(progressCounts(handled), {
    PENDING: 1,
    AWAITING_INFO: 1,
    REVIEW_COMPLETED: 1,
    ALL: 3,
  });
});

test("只有尚未處理且建議通過的案件可以批次完成", () => {
  const list = [
    item("EXP-1", "甲", "APPROVE"),
    item("EXP-2", "乙", "APPROVE", "REVIEW_COMPLETED"),
    item("EXP-3", "丙", "MANUAL_REVIEW"),
  ];
  assert.deepEqual(
    batchEligible(list).map((c) => c.caseNumber),
    ["EXP-1"],
  );
});

test("初審結果摘要取第一個 Finding，沒有 Finding 時明示已核對", () => {
  assert.equal(agentSummary([{ title: "申請金額比憑證多 NT$200" }]), "申請金額比憑證多 NT$200");
  assert.equal(agentSummary([]), "資料齊全，核對無誤");
});
