// 重新審查的差異摘要（specs/review-case.md 4.8、5.7）。

import { test } from "node:test";
import assert from "node:assert/strict";

import { diffReviews } from "../domain/review-diff.ts";

const f = (key: string, title: string) => ({ key, title });

test("只有一筆審查紀錄時沒有差異可比", () => {
  assert.equal(diffReviews([{ recommendation: "APPROVE", findings: [] }]), null);
});

test("比較最新與前一次：建議改變、新增與已解決的問題", () => {
  const diff = diffReviews([
    { recommendation: "REQUEST_INFO", findings: [f("missing-receipt", "缺少必要的住宿憑證")] },
    { recommendation: "APPROVE", findings: [] },
  ]);
  assert.deepEqual(diff, {
    previousRecommendation: "REQUEST_INFO",
    currentRecommendation: "APPROVE",
    recommendationChanged: true,
    added: [],
    resolved: [f("missing-receipt", "缺少必要的住宿憑證")],
  });
});

test("同一問題持續存在時不列為新增或已解決", () => {
  const diff = diffReviews([
    { recommendation: "MANUAL_REVIEW", findings: [f("a", "A"), f("b", "B")] },
    { recommendation: "MANUAL_REVIEW", findings: [f("b", "B"), f("c", "C")] },
  ]);
  assert.equal(diff?.recommendationChanged, false);
  assert.deepEqual(diff?.added, [f("c", "C")]);
  assert.deepEqual(diff?.resolved, [f("a", "A")]);
});

test("多次重審只比較最後兩次", () => {
  const diff = diffReviews([
    { recommendation: "MANUAL_REVIEW", findings: [f("a", "A")] },
    { recommendation: "REQUEST_INFO", findings: [f("b", "B")] },
    { recommendation: "REQUEST_INFO", findings: [f("b", "B")] },
  ]);
  assert.equal(diff?.previousRecommendation, "REQUEST_INFO");
  assert.deepEqual(diff?.added, []);
  assert.deepEqual(diff?.resolved, []);
});
