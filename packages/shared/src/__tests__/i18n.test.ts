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
    "rule.R1.PASS",
    "rule.R7.FAIL",
    "rule.R4.FAIL",
    "rule.guard.eligibility.ABSTAIN",
    "rule.R1.name",
    "rule.R4.name",
    "rule.R5.name",
    "rule.R7.name",
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

test("suspicion-only rules' FAIL copy is phrased as suspicion", () => {
  for (const code of ["R7", "R8"]) {
    const copy = lookupMessage(`rule.${code}.FAIL`);
    assert.ok(copy?.includes("疑似"), `rule.${code}.FAIL must say 疑似`);
  }
});
