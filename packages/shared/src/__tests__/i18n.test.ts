// i18n 組字測試：插值、缺鍵保底，以及 seed / API 目前會送出的每個 messageKey 都有文案。
// 缺文案時 UI 仍有通用句保底，但 demo 案件不該落到保底——這裡把它們釘住。

import { test } from "node:test";
import assert from "node:assert/strict";

import { t, lookupMessage } from "../i18n/format.ts";
import { zhTW } from "../i18n/zh-TW.ts";
import {
  caseStatusSchema,
  classificationSchema,
  consistencyFlagSchema,
  recommendedActionSchema,
  reviewerActionSchema,
  ruleOutcomeSchema,
} from "../enums.ts";

test("interpolates {name} placeholders from params", () => {
  const key = "__test.interpolate";
  (zhTW as Record<string, string>)[key] = "差額 {diff} 元，參照 {ref}";
  try {
    assert.equal(t(key, { diff: 300, ref: "EXP-1" }), "差額 300 元，參照 EXP-1");
    // 缺參數不把 {name} 字樣露給使用者
    assert.equal(t(key, { diff: 300 }), "差額 300 元，參照 ");
  } finally {
    delete (zhTW as Record<string, string>)[key];
  }
});

test("missing key falls back to fallbackKey, then a generic sentence — never the raw key", () => {
  assert.equal(t("rule.R99.FAIL", {}, "outcome.FAIL"), "此項檢查未通過。");
  const generic = t("rule.R99.FAIL");
  assert.notEqual(generic, "rule.R99.FAIL");
  assert.ok(generic.length > 0);
  assert.equal(lookupMessage("rule.R99.FAIL"), null);
});

test("every messageKey used by the current seed has copy", () => {
  const seedKeys = [
    // 規則判定理由（seed 的十情境實際送出的 outcome 訊息）
    "rule.R1.PASS",
    "rule.R1.FAIL",
    "rule.R1.GATED",
    "rule.R3.FAIL",
    "rule.R4.FAIL",
    "rule.R5.FAIL",
    "rule.R7.FAIL",
    "rule.R8.FAIL",
    "rule.R9.FAIL",
    "rule.R10.FAIL",
    "rule.guard.eligibility.ABSTAIN",
    // 雙假設評估分歧原因與比對層訊息
    "gate.amountMismatch",
    "match.unmatchedReceipt",
    // 規則名稱（規範頁面與檢查清單都會查）
    "rule.R1.name",
    "rule.R3.name",
    "rule.R4.name",
    "rule.R5.name",
    "rule.R7.name",
    "rule.R8.name",
    "rule.R9.name",
    "rule.R10.name",
    "rule.guard.eligibility.name",
  ];
  for (const key of seedKeys) {
    assert.ok(lookupMessage(key), `missing copy for ${key}`);
  }
});

test("every enum value the workbench displays has copy", () => {
  const expectations: Array<[string, readonly string[]]> = [
    ["classification", classificationSchema.options],
    ["classification", classificationSchema.options.map((c) => `${c}.hint`)],
    ["suggestion", classificationSchema.options],
    ["recommendedAction", recommendedActionSchema.options],
    ["finalAction", recommendedActionSchema.options],
    ["caseStatus", caseStatusSchema.options],
    ["consistencyFlag", consistencyFlagSchema.options],
    ["outcome", ruleOutcomeSchema.options],
  ];
  for (const [prefix, values] of expectations) {
    for (const v of values) {
      assert.ok(lookupMessage(`${prefix}.${v}`), `missing copy for ${prefix}.${v}`);
    }
  }
  for (const action of reviewerActionSchema.options.filter((a) => a !== "ACCEPT")) {
    assert.ok(lookupMessage(`action.${action}`), `missing copy for action.${action}`);
  }
  for (const rec of recommendedActionSchema.options) {
    assert.ok(lookupMessage(`action.ACCEPT.${rec}`), `missing copy for action.ACCEPT.${rec}`);
  }
});

test("every key the queue, closed page and history dialog display has copy", () => {
  const uiKeys = [
    // 篩選與搜尋
    "queue.filter.all",
    "queue.filter.all.hint",
    "queue.filter.classification.legend",
    "queue.filter.caseStatus.legend",
    "queue.search.label",
    "queue.search.placeholder",
    "queue.search.clear",
    "queue.filter.clear",
    "queue.resultCount",
    "queue.empty.noCases",
    "queue.empty.noMatch",
    "queue.empty.noSearchMatch",
    // 排序（每個排序鍵 × 方向都要有無障礙說明）
    "queue.sort.applicationDate",
    "queue.sort.caseNumber",
    "queue.sort.applicationDate.asc",
    "queue.sort.applicationDate.desc",
    "queue.sort.caseNumber.asc",
    "queue.sort.caseNumber.desc",
    // 已結案頁面
    "closed.title",
    "closed.subtitle",
    "closed.badge",
    "closed.empty",
    // 處置人
    "disposition.actor.label",
    "disposition.decidedAt.label",
    "disposition.actor.unknown",
    // 申請紀錄
    "caseHistory.title.applicant",
    "caseHistory.title.department",
    "caseHistory.open.applicant",
    "caseHistory.open.department",
    "caseHistory.current",
    "caseHistory.empty",
    "caseHistory.error",
    // 費用規範（唯讀）
    "policy.title",
    "policy.subtitle",
    "policy.readonly",
    "policy.currentVersion",
    "policy.nav.aria",
    "policy.section.clauses",
    "policy.section.clauses.hint",
    "policy.section.guardrails",
    "policy.section.guardrails.hint",
    "policy.builtin.badge",
    "policy.clauseRef.none",
    "policy.desc.none",
    "policy.suspicionOnly.badge",
    "policy.suspicionOnly.note",
    "policy.loading",
    "policy.error",
    "policy.retry",
    "policy.empty",
  ];
  for (const key of uiKeys) {
    assert.ok(lookupMessage(key), `missing copy for ${key}`);
  }
});

test("policy page copy marks suspicion-only rules as suspicion", () => {
  // 產品層 guardrail：只能標疑似的規則，其呈現必須帶出疑似語氣。這條文案是載具。
  for (const key of ["policy.suspicionOnly.badge", "policy.suspicionOnly.note"]) {
    const copy = lookupMessage(key);
    assert.ok(copy?.includes("疑似"), `${key} must say 疑似`);
  }
});

test("built-in guardrails carry a rule description for the policy page", () => {
  // 內建檢查沒有條文可引用，說明是唯一能解釋「它在檢查什麼」的東西。
  // 名稱「Agent 可判斷範圍」本身不足以讓審核人員知道發生了什麼。
  const desc = lookupMessage("rule.guard.eligibility.desc");
  assert.ok(desc, "missing rule.guard.eligibility.desc");
  assert.notEqual(desc, lookupMessage("rule.guard.eligibility.name"));
  // 這條是「資料不足不硬判 NORMAL」的體現，說明必須講出轉交人工這件事
  assert.ok(desc?.includes("人工"));
});

test("policy page copy states it is read-only and version-scoped", () => {
  assert.ok(lookupMessage("policy.readonly")?.includes("唯讀"));
  assert.ok(lookupMessage("policy.nav.aria")?.includes("唯讀"));
  // 頁面呈現的是「現在」的依據，不是任何個案當時的依據。
  assert.ok(lookupMessage("policy.currentVersion")?.includes("目前生效"));
});

test("policy page copy carries no conclusive or accusatory wording", () => {
  // 規範頁面只說明每條規則檢查什麼。Agent 不認定違規、不定罪。
  const forbidden = ["違規", "舞弊", "不法", "造假", "可疑", "風險分數"];
  for (const [key, copy] of Object.entries(zhTW)) {
    if (!key.startsWith("policy.")) continue;
    for (const word of forbidden) {
      assert.ok(!copy.includes(word), `${key} must not use conclusive wording "${word}"`);
    }
  }
});

test("result-count copy interpolates the count, including zero", () => {
  assert.equal(t("queue.resultCount", { count: 2 }), "共 2 筆");
  assert.equal(t("queue.resultCount", { count: 0 }), "共 0 筆");
});

test("history dialog copy carries no risk or accusation wording", () => {
  // 產品邊界：申請紀錄是唯讀清單，不得暗示「此人／此部門有問題」（跨案件風險判定屬 M2）。
  const forbidden = ["風險", "異常頻繁", "可疑", "舞弊", "警示"];
  for (const [key, copy] of Object.entries(zhTW)) {
    if (!key.startsWith("caseHistory.")) continue;
    for (const word of forbidden) {
      assert.ok(!copy.includes(word), `${key} must not use accusatory wording "${word}"`);
    }
  }
});

test("suspicion-only rules' FAIL copy is phrased as suspicion", () => {
  for (const code of ["R7", "R8"]) {
    const copy = lookupMessage(`rule.${code}.FAIL`);
    assert.ok(copy?.includes("疑似"), `rule.${code}.FAIL must say 疑似`);
  }
});
