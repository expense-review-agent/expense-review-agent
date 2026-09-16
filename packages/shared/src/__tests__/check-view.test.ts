// 檢查清單顯示模型測試——顯示層 guardrail：
// 非通過不顯示為通過、疑似類規則一律「疑似」、非通過缺證據必須被標示。

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  toCheckView,
  outcomeTone,
  groupHumanAnalysis,
  relatedCasesFromChecks,
} from "../presentation/check-view.ts";
import type { CaseCheck } from "../api.ts";
import type { RuleOutcome } from "../enums.ts";

function check(overrides: Partial<CaseCheck> = {}): CaseCheck {
  return {
    checkKey: "R1-lodging",
    ruleCode: "R1",
    outcome: "PASS",
    isSuspicionOnly: false,
    severity: "MEDIUM",
    messageKey: "rule.R1.PASS",
    messageParams: {},
    policyRef: "§4.2",
    policyText: "住宿每晚上限 NT$4,000",
    evidence: [],
    ...overrides,
  };
}

const evidence = { snippet: "證據", relatedCaseId: null, relatedCaseNumber: null };

test("only PASS maps to ok; every non-pass outcome is never ok", () => {
  const expected: Record<RuleOutcome, string> = {
    PASS: "ok",
    FAIL: "fail",
    GATED: "attention",
    ABSTAIN: "attention",
    PENDING_HUMAN: "attention",
  };
  for (const [outcome, tone] of Object.entries(expected)) {
    assert.equal(outcomeTone(outcome as RuleOutcome), tone, outcome);
  }
});

test("GATED / ABSTAIN / PENDING_HUMAN render as 需人工確認", () => {
  for (const outcome of ["GATED", "ABSTAIN", "PENDING_HUMAN"] as const) {
    const view = toCheckView(
      check({ outcome, messageKey: `rule.R1.${outcome}`, evidence: [evidence] }),
    );
    assert.equal(view.tone, "attention");
    assert.equal(view.statusLabel, "需人工確認");
  }
});

test("suspicion-only rule failing is titled and described as 疑似", () => {
  const view = toCheckView(
    check({
      checkKey: "R7-duplicate",
      ruleCode: "R7",
      outcome: "FAIL",
      isSuspicionOnly: true,
      messageKey: "rule.R7.FAIL",
      evidence: [{ snippet: "同單號", relatedCaseId: "c1", relatedCaseNumber: "EXP-2026-1043" }],
    }),
  );
  assert.ok(view.title.startsWith("疑似"), view.title);
  assert.equal(view.statusLabel, "疑似");
  assert.ok(view.detail.includes("疑似"), view.detail);
  assert.equal(view.isSuspicion, true);
});

test("suspicion guardrail holds even when copy omits 疑似 or the key is missing", () => {
  for (const messageKey of ["rule.R1.FAIL", "rule.R8.UNKNOWN"]) {
    const view = toCheckView(
      check({
        ruleCode: "R8",
        outcome: "FAIL",
        isSuspicionOnly: true,
        messageKey,
        evidence: [evidence],
      }),
    );
    assert.ok(view.detail.includes("疑似"), `${messageKey}: ${view.detail}`);
    assert.ok(view.title.startsWith("疑似"));
  }
});

test("suspicion-only rule passing is not labelled 疑似", () => {
  const view = toCheckView(
    check({ ruleCode: "R7", isSuspicionOnly: true, messageKey: "rule.R7.PASS" }),
  );
  assert.equal(view.isSuspicion, false);
  assert.ok(!view.title.startsWith("疑似"));
});

test("non-pass check without evidence is flagged evidenceMissing", () => {
  assert.equal(
    toCheckView(check({ outcome: "FAIL", messageKey: "rule.R1.FAIL" })).evidenceMissing,
    true,
  );
  assert.equal(
    toCheckView(check({ outcome: "FAIL", messageKey: "rule.R1.FAIL", evidence: [evidence] }))
      .evidenceMissing,
    false,
  );
  assert.equal(toCheckView(check()).evidenceMissing, false);
});

test("missing message key falls back to outcome sentence, never the raw key", () => {
  const view = toCheckView(
    check({ outcome: "ABSTAIN", messageKey: "rule.R42.ABSTAIN", evidence: [evidence] }),
  );
  assert.equal(view.detail, "Agent 無法判斷此項，已轉交人工。");
  assert.equal(view.title, "住宿費額度");
  // 規則名稱也缺文案時顯示規則代碼，而不是 i18n 鍵
  assert.equal(toCheckView(check({ ruleCode: "R42" })).title, "規則 R42");
});

test("guardrail rule code resolves to its display name", () => {
  const view = toCheckView(
    check({
      ruleCode: "GUARD_ELIGIBILITY",
      outcome: "ABSTAIN",
      messageKey: "rule.guard.eligibility.ABSTAIN",
      evidence: [evidence],
    }),
  );
  assert.equal(view.title, "Agent 可判斷範圍");
});

test("human analysis groups by tone without inventing verdicts", () => {
  const views = [
    toCheckView(check()),
    toCheckView(check({ checkKey: "g", outcome: "GATED", evidence: [evidence] })),
    toCheckView(check({ checkKey: "f", outcome: "FAIL", evidence: [evidence] })),
  ];
  const grouped = groupHumanAnalysis(views);
  assert.deepEqual(
    grouped.completed.map((v) => v.key),
    ["R1-lodging"],
  );
  assert.deepEqual(
    grouped.uncertain.map((v) => v.key),
    ["g", "f"],
  );
});

test("related cases are collected across checks and de-duplicated", () => {
  const rel = { snippet: null, relatedCaseId: "c1", relatedCaseNumber: "EXP-2026-1043" };
  const views = [
    toCheckView(check({ checkKey: "a", outcome: "FAIL", evidence: [rel] })),
    toCheckView(check({ checkKey: "b", outcome: "FAIL", evidence: [rel, evidence] })),
  ];
  assert.deepEqual(relatedCasesFromChecks(views), [{ id: "c1", caseNumber: "EXP-2026-1043" }]);
});
