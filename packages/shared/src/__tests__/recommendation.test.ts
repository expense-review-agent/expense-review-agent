// 審查建議推導與審查紀錄一致性（specs/review-case.md 5.3–5.5）。

import { test } from "node:test";
import assert from "node:assert/strict";

import { deriveRecommendation, reviewConsistencyProblems } from "../domain/recommendation.ts";
import type { CheckResultData, FindingData } from "../domain/types.ts";

const pass = (dimension: CheckResultData["dimension"]): CheckResultData => ({
  dimension,
  status: "PASS",
  summary: "未見異常",
});
const allPass: CheckResultData[] = [
  pass("EVIDENCE_MATCH"),
  pass("CORPORATE_POLICY"),
  { dimension: "COMPLIANCE", status: "NOT_APPLICABLE", summary: "不適用" },
  pass("RISK_SIGNAL"),
];

function finding(kind: FindingData["kind"], dimension: FindingData["dimension"]): FindingData {
  return {
    key: `${kind}-${dimension}`,
    dimension,
    kind,
    title: "t",
    explanation: "e",
    ruleCode: "X-01",
    ruleText: "規則",
    comparison: [],
    relatedCaseNumber: null,
    nextStep: null,
  };
}

test("沒有 Finding → 建議通過", () => {
  assert.equal(deriveRecommendation([]), "APPROVE");
});

test("只有可補正的缺漏 → 建議補件", () => {
  assert.equal(deriveRecommendation([finding("MISSING", "EVIDENCE_MATCH")]), "REQUEST_INFO");
});

test("明確異常 → 建議人工審核", () => {
  assert.equal(deriveRecommendation([finding("ANOMALY", "CORPORATE_POLICY")]), "MANUAL_REVIEW");
});

test("系統無法判斷 → 建議人工審核", () => {
  assert.equal(
    deriveRecommendation([finding("UNDETERMINED", "CORPORATE_POLICY")]),
    "MANUAL_REVIEW",
  );
});

test("補件與人工審核條件並存時，人工審核優先", () => {
  const findings = [finding("MISSING", "EVIDENCE_MATCH"), finding("ANOMALY", "RISK_SIGNAL")];
  assert.equal(deriveRecommendation(findings), "MANUAL_REVIEW");
});

test("一致的審查紀錄沒有問題", () => {
  assert.deepEqual(
    reviewConsistencyProblems({ recommendation: "APPROVE", checks: allPass, findings: [] }),
    [],
  );
});

test("每個面向恰好一筆檢核結果，不以沉默代表通過", () => {
  const problems = reviewConsistencyProblems({
    recommendation: "APPROVE",
    checks: allPass.slice(0, 3),
    findings: [],
  });
  assert.ok(problems.some((p) => p.includes("RISK_SIGNAL")));
});

test("預置建議與推導結果不同 → 不一致", () => {
  const problems = reviewConsistencyProblems({
    recommendation: "APPROVE",
    checks: [{ dimension: "EVIDENCE_MATCH", status: "FAIL", summary: "缺件" }, ...allPass.slice(1)],
    findings: [finding("MISSING", "EVIDENCE_MATCH")],
  });
  assert.ok(problems.some((p) => p.includes("REQUEST_INFO")));
});

test("未通過或無法判斷的面向必須有對應 Finding", () => {
  const problems = reviewConsistencyProblems({
    recommendation: "APPROVE",
    checks: [{ dimension: "EVIDENCE_MATCH", status: "FAIL", summary: "?" }, ...allPass.slice(1)],
    findings: [],
  });
  assert.ok(problems.some((p) => p.includes("EVIDENCE_MATCH")));
});

test("Finding 所在面向的檢核不得標示為通過或不適用", () => {
  const problems = reviewConsistencyProblems({
    recommendation: "MANUAL_REVIEW",
    checks: allPass,
    findings: [finding("ANOMALY", "CORPORATE_POLICY")],
  });
  assert.ok(problems.some((p) => p.includes("CORPORATE_POLICY")));
});

test("無法判斷的 Finding 必須對應無法判斷的檢核，與未通過區分", () => {
  const problems = reviewConsistencyProblems({
    recommendation: "MANUAL_REVIEW",
    checks: [
      pass("EVIDENCE_MATCH"),
      { dimension: "CORPORATE_POLICY", status: "FAIL", summary: "?" },
      ...allPass.slice(2),
    ],
    findings: [finding("UNDETERMINED", "CORPORATE_POLICY")],
  });
  assert.ok(problems.some((p) => p.includes("UNDETERMINED")));
});

test("每個 Finding 都要能回溯到判斷依據", () => {
  const problems = reviewConsistencyProblems({
    recommendation: "MANUAL_REVIEW",
    checks: [
      pass("EVIDENCE_MATCH"),
      { dimension: "CORPORATE_POLICY", status: "FAIL", summary: "超額" },
      ...allPass.slice(2),
    ],
    findings: [{ ...finding("ANOMALY", "CORPORATE_POLICY"), ruleText: "  " }],
  });
  assert.ok(problems.some((p) => p.includes("依據")));
});
