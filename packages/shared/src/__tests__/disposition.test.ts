// Disposition matrix tests — legal actions, illegal rejection, MANUAL_REVIEW
// escalation. Uses Node's built-in test runner (node:test).

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DISPOSITION_MATRIX,
  isLegalDisposition,
  resolveDisposition,
  permittedActions,
} from "../domain/disposition.ts";

test("illegal action for a recommendation is rejected", () => {
  // APPROVE does not permit accepting-into a supervisor-only flow with a bogus action.
  assert.equal(isLegalDisposition("APPROVE", "HOLD"), true);
  // A made-up action is rejected.
  assert.equal(isLegalDisposition("APPROVE", "NOT_AN_ACTION" as never), false);
  assert.throws(() => resolveDisposition("APPROVE", "NOT_AN_ACTION" as never));
});

test("accepting MANUAL_REVIEW escalates rather than concludes", () => {
  const rule = resolveDisposition("MANUAL_REVIEW", "ACCEPT");
  assert.equal(rule.escalates, true);
});

test("accepting APPROVE disposes without escalation", () => {
  const rule = resolveDisposition("APPROVE", "ACCEPT");
  assert.equal(rule.resultingStatus, "DISPOSED");
  assert.notEqual(rule.escalates, true);
});

test("accepting REQUEST_INFO moves case to AWAITING_INFO", () => {
  const rule = resolveDisposition("REQUEST_INFO", "ACCEPT");
  assert.equal(rule.resultingStatus, "AWAITING_INFO");
});

test("HOLD keeps the case in QUEUED for every recommendation", () => {
  for (const rec of ["APPROVE", "REQUEST_INFO", "MANUAL_REVIEW"] as const) {
    assert.equal(resolveDisposition(rec, "HOLD").resultingStatus, "QUEUED");
  }
});

test("every recommendation permits at least ACCEPT", () => {
  for (const rec of Object.keys(DISPOSITION_MATRIX) as Array<keyof typeof DISPOSITION_MATRIX>) {
    assert.ok(permittedActions(rec).includes("ACCEPT"));
  }
});
