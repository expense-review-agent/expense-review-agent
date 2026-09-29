// 檢查清單與建議卡片的顯示邏輯。

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FIELD_STATUS_LABEL,
  amountCheckSummary,
  checkRowView,
  recommendationCardBody,
} from "../presentation/labels.ts";
import type { FindingData } from "../domain/types.ts";

const finding = (overrides: Partial<FindingData>): FindingData => ({
  key: "k",
  dimension: "EVIDENCE_MATCH",
  kind: "ANOMALY",
  title: "申請金額比憑證多 NT$200",
  explanation: "申請為 NT$1,680，憑證為 NT$1,480。",
  ruleCode: "E-01",
  ruleText: "模擬比對規則 E-01",
  comparison: [
    ["申請金額", "NT$1,680"],
    ["憑證金額", "NT$1,480"],
  ],
  relatedCaseNumber: null,
  nextStep: null,
  ...overrides,
});

test("沒有 Finding 的通過項目顯示「未見異常」與檢核結論", () => {
  const view = checkRowView(
    { dimension: "EVIDENCE_MATCH", status: "PASS", summary: "申請與憑證金額一致" },
    [],
  );
  assert.equal(view.tone, "ok");
  assert.equal(view.label, "未見異常");
  assert.equal(view.text, "申請與憑證金額一致");
  assert.equal(view.figures, null);
});

test("不適用的項目不使用通過的綠勾", () => {
  const view = checkRowView(
    { dimension: "COMPLIANCE", status: "NOT_APPLICABLE", summary: "不適用：未達示範門檻" },
    [],
  );
  assert.equal(view.tone, "na");
  assert.equal(view.label, "不適用");
});

test("有 Finding 時依性質區分缺件、需確認、無法判斷，並直接顯示關鍵數字", () => {
  const check = {
    dimension: "EVIDENCE_MATCH" as const,
    status: "FAIL" as const,
    summary: "申請金額比憑證多 NT$200",
  };
  const issue = checkRowView(check, [finding({})]);
  assert.equal(issue.tone, "issue");
  assert.equal(issue.label, "需確認");
  assert.equal(issue.figures, "申請金額 NT$1,680，憑證金額 NT$1,480");

  assert.equal(checkRowView(check, [finding({ kind: "MISSING" })]).label, "缺件");
  const unknown = checkRowView(
    { dimension: "EVIDENCE_MATCH", status: "UNDETERMINED", summary: "無法對應" },
    [finding({ kind: "UNDETERMINED" })],
  );
  assert.equal(unknown.tone, "unknown");
  assert.equal(unknown.label, "無法判斷");
});

test("建議通過的卡片說明可完成初審", () => {
  assert.equal(
    recommendationCardBody({ recommendation: "APPROVE", findings: [] }),
    "資料齊全，核對無誤，可完成初審。",
  );
});

test("其他建議依 Finding 的下一步說明，沒有下一步時用原因說明", () => {
  assert.equal(
    recommendationCardBody({
      recommendation: "REQUEST_INFO",
      findings: [finding({ kind: "MISSING", nextStep: "請補充住宿憑證。" })],
    }),
    "請補充住宿憑證。",
  );
  assert.equal(
    recommendationCardBody({ recommendation: "MANUAL_REVIEW", findings: [finding({})] }),
    "申請為 NT$1,680，憑證為 NT$1,480。",
  );
});

test("「無法辨識」與「單據上沒有此欄位」使用不同文字（receipt-reading 4.3）", () => {
  assert.notEqual(FIELD_STATUS_LABEL.UNREADABLE, FIELD_STATUS_LABEL.NOT_ON_RECEIPT);
});

test("讀取金額比對的摘要說明差額方向", () => {
  const base = { rule: "E-01 v1" as const, reason: "r" };
  assert.equal(
    amountCheckSummary({
      ...base,
      status: "MISMATCH",
      applicationCents: 168000,
      evidenceCents: 148000,
      differenceCents: 20000,
    }),
    "申請金額比憑證多 NT$200",
  );
  assert.equal(
    amountCheckSummary({
      ...base,
      status: "MISMATCH",
      applicationCents: 100000,
      evidenceCents: 105000,
      differenceCents: -5000,
    }),
    "申請金額比憑證少 NT$50",
  );
  assert.equal(amountCheckSummary({ ...base, status: "MATCH", differenceCents: 0 }), "金額一致");
  assert.equal(amountCheckSummary({ ...base, status: "MISSING_EVIDENCE" }), "缺憑證");
  assert.equal(amountCheckSummary({ ...base, status: "UNDETERMINED" }), "無法判斷");
});
