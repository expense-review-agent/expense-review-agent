// 人工流程動作與批次完成的規則（interaction-patterns.md「本輪工作台操作提案」）。
// 移植自 CheckMate 的 workbench.test.ts 中 recordDecision / completeBatch 的案例。

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateBatchComplete, validateWorkflowAction } from "../domain/workflow-action.ts";

const latest = { key: "REV-003-1", recommendation: "MANUAL_REVIEW" as const };

test("人工處理不改寫原始建議，並回傳處理後狀態與整理過的原因", () => {
  const result = validateWorkflowAction({
    latestReview: latest,
    targetReviewKey: "REV-003-1",
    alreadyHandled: false,
    action: "PROCEED",
    reason: "  已核對額外交通費證明 ",
  });
  assert.deepEqual(result, {
    ok: true,
    reason: "已核對額外交通費證明",
    resultingStatus: "REVIEW_COMPLETED",
    originalRecommendation: "MANUAL_REVIEW",
  });
});

test("退回補件後進入待補件，不算已完成", () => {
  const result = validateWorkflowAction({
    latestReview: { key: "REV-002-1", recommendation: "REQUEST_INFO" },
    targetReviewKey: "REV-002-1",
    alreadyHandled: false,
    action: "REQUEST_INFO",
    reason: "請補住宿憑證",
  });
  assert.equal(result.ok && result.resultingStatus, "AWAITING_INFO");
});

test("人工通過例外案件必須填寫原因", () => {
  const result = validateWorkflowAction({
    latestReview: latest,
    targetReviewKey: "REV-003-1",
    alreadyHandled: false,
    action: "PROCEED",
    reason: " ",
  });
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.code, "REASON_REQUIRED");
});

test("缺件案件人工通過也必須提供依據", () => {
  const input = {
    latestReview: { key: "REV-002-1", recommendation: "REQUEST_INFO" as const },
    targetReviewKey: "REV-002-1",
    alreadyHandled: false,
    action: "PROCEED" as const,
  };
  assert.equal(validateWorkflowAction({ ...input, reason: "" }).ok, false);
  assert.equal(validateWorkflowAction({ ...input, reason: "已核對其他附件中的住宿憑證" }).ok, true);
});

test("退回補件一律要有補件內容，建議通過的案件也一樣", () => {
  const result = validateWorkflowAction({
    latestReview: { key: "REV-001-2", recommendation: "APPROVE" },
    targetReviewKey: "REV-001-2",
    alreadyHandled: false,
    action: "REQUEST_INFO",
    reason: "",
  });
  assert.equal(!result.ok && result.code, "REASON_REQUIRED");
});

test("建議通過的案件完成初審不需要原因", () => {
  const result = validateWorkflowAction({
    latestReview: { key: "REV-001-2", recommendation: "APPROVE" },
    targetReviewKey: "REV-001-2",
    alreadyHandled: false,
    action: "PROCEED",
    reason: "",
  });
  assert.equal(result.ok, true);
});

test("歷史紀錄不能執行處置", () => {
  const result = validateWorkflowAction({
    latestReview: { key: "REV-001-2", recommendation: "APPROVE" },
    targetReviewKey: "REV-001-1",
    alreadyHandled: false,
    action: "PROCEED",
    reason: "",
  });
  assert.equal(!result.ok && result.code, "NOT_LATEST_REVIEW");
});

test("已處理的案件不能重複送出", () => {
  const result = validateWorkflowAction({
    latestReview: { key: "REV-001-2", recommendation: "APPROVE" },
    targetReviewKey: "REV-001-2",
    alreadyHandled: true,
    action: "PROCEED",
    reason: "",
  });
  assert.equal(!result.ok && result.code, "ALREADY_HANDLED");
});

const approved = (caseNumber: string, handled = false) => ({
  caseNumber,
  latestRecommendation: "APPROVE" as const,
  handled,
});

test("批次只接受未處理且建議通過的案件", () => {
  assert.deepEqual(validateBatchComplete([approved("EXP-1"), approved("EXP-2")]), { ok: true });
});

test("混入例外案件時整批不執行", () => {
  const result = validateBatchComplete([
    approved("EXP-1"),
    { caseNumber: "EXP-2", latestRecommendation: "REQUEST_INFO", handled: false },
  ]);
  assert.equal(!result.ok && result.code, "NOT_ELIGIBLE");
});

test("混入已處理案件時整批不執行", () => {
  const result = validateBatchComplete([approved("EXP-1", true)]);
  assert.equal(!result.ok && result.code, "NOT_ELIGIBLE");
});

test("空選取或重複案件不接受", () => {
  assert.equal(validateBatchComplete([]).ok, false);
  assert.equal(validateBatchComplete([approved("EXP-1"), approved("EXP-1")]).ok, false);
});
