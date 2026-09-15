// 工作台處置選項測試：動作集合與合法動作矩陣一致、只有人工判斷帶 finalAction、
// 理由必填規則與後端（矩陣 ∪ 徽章算式）一致。

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  dispositionOptions,
  buildDispositionRequest,
  isReasonRequired,
  canSubmitDisposition,
  judgementFinalActions,
  resolveFinalAction,
} from "../presentation/disposition-options.ts";
import {
  permittedActions,
  resolveDisposition,
  deriveConsistencyFlag,
} from "../domain/disposition.ts";
import type { RecommendedAction, ReviewerAction } from "../enums.ts";

const RECOMMENDATIONS: RecommendedAction[] = ["APPROVE", "REQUEST_INFO", "MANUAL_REVIEW"];

test("options mirror the disposition matrix exactly, in matrix order", () => {
  for (const rec of RECOMMENDATIONS) {
    assert.deepEqual(
      dispositionOptions(rec).map((o) => o.action),
      permittedActions(rec),
      rec,
    );
  }
});

test("labels per recommendation match the workbench spec", () => {
  assert.deepEqual(
    dispositionOptions("APPROVE").map((o) => o.label),
    ["確認通過", "退回補件", "人工判斷", "暫緩處理"],
  );
  assert.deepEqual(
    dispositionOptions("REQUEST_INFO").map((o) => o.label),
    ["確認退回補件", "人工判斷", "暫緩處理"],
  );
  const manual = dispositionOptions("MANUAL_REVIEW");
  assert.equal(manual[0]?.label, "轉呈主管");
  assert.ok(manual[0]?.hint.includes("不下最終結論"));
});

test("only MANUAL_JUDGEMENT opens the judgement dialog", () => {
  for (const rec of RECOMMENDATIONS) {
    for (const o of dispositionOptions(rec)) {
      assert.equal(o.opensJudgementDialog, o.action === "MANUAL_JUDGEMENT");
    }
  }
});

test("request carries finalAction only for MANUAL_JUDGEMENT", () => {
  const actions: ReviewerAction[] = ["ACCEPT", "REQUEST_INFO", "HOLD"];
  for (const action of actions) {
    const req = buildDispositionRequest({
      runId: "r1",
      action,
      reason: "x",
      finalAction: "APPROVE",
    });
    assert.equal("finalAction" in req, false, action);
  }
  const mj = buildDispositionRequest({
    runId: "r1",
    action: "MANUAL_JUDGEMENT",
    reason: "  依合約補件  ",
    finalAction: "REQUEST_INFO",
  });
  assert.deepEqual(mj, {
    runId: "r1",
    action: "MANUAL_JUDGEMENT",
    reason: "依合約補件",
    finalAction: "REQUEST_INFO",
  });
  assert.throws(() =>
    buildDispositionRequest({
      runId: "r1",
      action: "MANUAL_JUDGEMENT",
      reason: "x",
      finalAction: null,
    }),
  );
});

test("blank reason is omitted from the request", () => {
  const req = buildDispositionRequest({
    runId: "r1",
    action: "HOLD",
    reason: "   ",
    finalAction: null,
  });
  assert.deepEqual(req, { runId: "r1", action: "HOLD" });
});

test("reason requirement equals matrix rule OR flag derivation (backend parity)", () => {
  const finals: Array<RecommendedAction | null> = [null, ...RECOMMENDATIONS];
  for (const rec of RECOMMENDATIONS) {
    for (const action of permittedActions(rec)) {
      for (const specified of finals) {
        const final = resolveFinalAction(action, rec, specified);
        const expected =
          Boolean(resolveDisposition(rec, action).reasonRequired) ||
          deriveConsistencyFlag({ agentActionAtDecision: rec, finalAction: final }).reasonRequired;
        assert.equal(
          isReasonRequired(rec, action, specified),
          expected,
          `${rec}/${action}/${specified}`,
        );
      }
    }
  }
});

test("known reason requirements", () => {
  assert.equal(isReasonRequired("APPROVE", "ACCEPT"), false);
  assert.equal(isReasonRequired("APPROVE", "REQUEST_INFO"), true);
  assert.equal(isReasonRequired("APPROVE", "HOLD"), false);
  assert.equal(isReasonRequired("MANUAL_REVIEW", "ACCEPT"), false);
  assert.equal(isReasonRequired("MANUAL_REVIEW", "MANUAL_JUDGEMENT", "APPROVE"), true);
});

test("submit is blocked without required reason or without judgement conclusion", () => {
  const base = { runId: "r1", reason: "", finalAction: null };
  assert.equal(canSubmitDisposition("APPROVE", { ...base, action: "ACCEPT" }), true);
  assert.equal(canSubmitDisposition("APPROVE", { ...base, action: "REQUEST_INFO" }), false);
  assert.equal(
    canSubmitDisposition("APPROVE", { ...base, action: "REQUEST_INFO", reason: "  " }),
    false,
  );
  assert.equal(canSubmitDisposition("APPROVE", { ...base, action: "HOLD" }), true);
  assert.equal(
    canSubmitDisposition("APPROVE", { ...base, action: "MANUAL_JUDGEMENT", reason: "理由" }),
    false,
  );
  assert.equal(
    canSubmitDisposition("APPROVE", {
      ...base,
      action: "MANUAL_JUDGEMENT",
      reason: "理由",
      finalAction: "REQUEST_INFO",
    }),
    true,
  );
});

test("judgement dialog offers all three conclusions", () => {
  assert.deepEqual(
    judgementFinalActions().map((o) => o.value),
    ["APPROVE", "REQUEST_INFO", "MANUAL_REVIEW"],
  );
});
