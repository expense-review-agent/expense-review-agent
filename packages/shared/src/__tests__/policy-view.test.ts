// 費用規範顯示模型測試——兩層規則的分流，以及「疑似標註不得在呈現層遺失」的邊界。

import { test } from "node:test";
import assert from "node:assert/strict";

import type { PolicyItem } from "../api.ts";
import { buildPolicyView } from "../presentation/policy-view.ts";

/** 組織條文型項目（帶條文參照與原文）。 */
function clause(over: Partial<PolicyItem> & Pick<PolicyItem, "ruleCode">): PolicyItem {
  return {
    ruleKey: `${over.ruleCode}-key`,
    ruleCode: over.ruleCode,
    nameKey: `rule.${over.ruleCode}.name`,
    descKey: null,
    clauseRef: "§1.1",
    clauseText: "條文原文",
    category: null,
    params: {},
    violationHandling: null,
    isSuspicionOnly: false,
    isGuardrail: false,
    ...over,
  };
}

/** 產品內建安全邊界（沒有條文）。 */
function guardrail(over: Partial<PolicyItem> & Pick<PolicyItem, "ruleCode">): PolicyItem {
  return {
    ...clause(over),
    clauseRef: null,
    clauseText: null,
    isGuardrail: true,
    ...over,
  };
}

test("splits organization clauses from built-in guardrails", () => {
  const view = buildPolicyView([
    clause({ ruleCode: "R1" }),
    guardrail({ ruleCode: "GUARD_ELIGIBILITY" }),
    clause({ ruleCode: "R4" }),
  ]);

  assert.deepEqual(
    view.clauses.map((item) => item.ruleCode),
    ["R1", "R4"],
  );
  assert.deepEqual(
    view.guardrails.map((item) => item.ruleCode),
    ["GUARD_ELIGIBILITY"],
  );
});

test("preserves input order within each section", () => {
  // 條文順序由後端的 orderIndex 決定（組織排的），呈現層不得自行重排。
  const view = buildPolicyView([
    clause({ ruleCode: "R7" }),
    clause({ ruleCode: "R1" }),
    clause({ ruleCode: "R4" }),
    guardrail({ ruleCode: "GUARD_B" }),
    guardrail({ ruleCode: "GUARD_A" }),
  ]);

  assert.deepEqual(
    view.clauses.map((item) => item.ruleCode),
    ["R7", "R1", "R4"],
  );
  assert.deepEqual(
    view.guardrails.map((item) => item.ruleCode),
    ["GUARD_B", "GUARD_A"],
  );
});

test("total equals the sum of both sections", () => {
  const items = [
    clause({ ruleCode: "R1" }),
    clause({ ruleCode: "R4" }),
    guardrail({ ruleCode: "GUARD_ELIGIBILITY" }),
  ];
  const view = buildPolicyView(items);

  assert.equal(view.total, items.length);
  assert.equal(view.total, view.clauses.length + view.guardrails.length);
});

test("every guardrail row carries no clause fields", () => {
  // 內建檢查沒有條文可引用；頁面不得以系統文案偽造成條文。
  const view = buildPolicyView([
    clause({ ruleCode: "R1" }),
    guardrail({ ruleCode: "GUARD_ELIGIBILITY" }),
    guardrail({ ruleCode: "GUARD_OTHER" }),
  ]);

  assert.notEqual(view.guardrails.length, 0);
  for (const item of view.guardrails) {
    assert.equal(item.clauseRef, null);
    assert.equal(item.clauseText, null);
  }
});

test("empty input yields two empty sections", () => {
  const view = buildPolicyView([]);

  assert.deepEqual(view.clauses, []);
  assert.deepEqual(view.guardrails, []);
  assert.equal(view.total, 0);
});

test("suspicion-only flag survives the split in both sections", () => {
  // 這個旗標是產品層 guardrail「不指控」的載具。呈現層把它弄掉，
  // 頁面就沒有東西可以據以標註「疑似」。
  const view = buildPolicyView([
    clause({ ruleCode: "R7", isSuspicionOnly: true }),
    clause({ ruleCode: "R1", isSuspicionOnly: false }),
    guardrail({ ruleCode: "GUARD_SUSPECT", isSuspicionOnly: true }),
  ]);

  const flags = [...view.clauses, ...view.guardrails].map((item) => [
    item.ruleCode,
    item.isSuspicionOnly,
  ]);
  assert.deepEqual(flags, [
    ["R7", true],
    ["R1", false],
    ["GUARD_SUSPECT", true],
  ]);
});

test("clause text is passed through unchanged", () => {
  // 條文原文是組織擁有的內容，MUST 原樣呈現——不得改寫、翻譯或以系統文案替代。
  const original = "住宿每晚上限 NT$4,000（含稅）";
  const view = buildPolicyView([clause({ ruleCode: "R1", clauseText: original })]);

  assert.equal(view.clauses[0]?.clauseText, original);
});
