// Consistency flag derivation tests — exhaustive over the decided algorithm.
// The badge is what M1-U2 (supervisor traceability) reads, and Disposition is
// append-only: a wrong badge cannot be corrected, only appended over. So this
// covers the full input cross-product rather than a few representative cases.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  deriveConsistencyFlag,
  resolveDisposition,
  permittedActions,
  type ConsistencyFlagResult,
} from "../domain/disposition.ts";
import type { RecommendedAction, ReviewerAction } from "../enums.ts";

/** All agent recommendations, plus the "agent reached no conclusion" edge. */
const AGENT_ACTIONS: Array<RecommendedAction | null> = [
  "APPROVE",
  "REQUEST_INFO",
  "MANUAL_REVIEW",
  null,
];

/** All human conclusions, plus `null` = reviewer deferred (HOLD). */
const FINAL_ACTIONS: Array<RecommendedAction | null> = [
  "APPROVE",
  "REQUEST_INFO",
  "MANUAL_REVIEW",
  null,
];

/**
 * The decided algorithm, written out as a lookup table rather than re-derived,
 * so the test fails if the implementation drifts toward a different rule.
 * Rows: agentActionAtDecision. Columns: finalAction.
 */
const EXPECTED: Record<string, Record<string, ConsistencyFlagResult>> = {
  APPROVE: {
    APPROVE: { flag: "CONSISTENT", reasonRequired: false },
    REQUEST_INFO: { flag: "OVERRIDDEN", reasonRequired: true },
    MANUAL_REVIEW: { flag: "OVERRIDDEN", reasonRequired: true },
    null: { flag: "PENDING_DECISION", reasonRequired: false },
  },
  REQUEST_INFO: {
    APPROVE: { flag: "OVERRIDDEN", reasonRequired: true },
    REQUEST_INFO: { flag: "CONSISTENT", reasonRequired: false },
    MANUAL_REVIEW: { flag: "OVERRIDDEN", reasonRequired: true },
    null: { flag: "PENDING_DECISION", reasonRequired: false },
  },
  MANUAL_REVIEW: {
    APPROVE: { flag: "HUMAN_ASSUMED", reasonRequired: true },
    REQUEST_INFO: { flag: "HUMAN_ASSUMED", reasonRequired: true },
    MANUAL_REVIEW: { flag: "ESCALATED", reasonRequired: false },
    null: { flag: "PENDING_DECISION", reasonRequired: false },
  },
  null: {
    APPROVE: { flag: "HUMAN_ASSUMED", reasonRequired: true },
    REQUEST_INFO: { flag: "HUMAN_ASSUMED", reasonRequired: true },
    MANUAL_REVIEW: { flag: "HUMAN_ASSUMED", reasonRequired: true },
    null: { flag: "PENDING_DECISION", reasonRequired: false },
  },
};

test("derivation covers every (agentActionAtDecision, finalAction) pairing", () => {
  let checked = 0;
  for (const agent of AGENT_ACTIONS) {
    for (const final of FINAL_ACTIONS) {
      const actual = deriveConsistencyFlag({
        agentActionAtDecision: agent,
        finalAction: final,
      });
      const expected = EXPECTED[String(agent)][String(final)];
      assert.deepEqual(
        actual,
        expected,
        `agent=${String(agent)} final=${String(final)} expected ${expected.flag}, got ${actual.flag}`,
      );
      checked += 1;
    }
  }
  // 4 agent states x 4 final states — guards against a shrunken table.
  assert.equal(checked, 16);
});

test("agreeing with a concluded agent suggestion is CONSISTENT and needs no reason", () => {
  for (const agent of ["APPROVE", "REQUEST_INFO"] as const) {
    const r = deriveConsistencyFlag({ agentActionAtDecision: agent, finalAction: agent });
    assert.equal(r.flag, "CONSISTENT");
    assert.equal(r.reasonRequired, false);
  }
});

test("overriding a concluded agent suggestion requires a reason", () => {
  const r = deriveConsistencyFlag({
    agentActionAtDecision: "APPROVE",
    finalAction: "REQUEST_INFO",
  });
  assert.equal(r.flag, "OVERRIDDEN");
  assert.equal(r.reasonRequired, true);
});

test("human concluding on a MANUAL_REVIEW case is HUMAN_ASSUMED, not ESCALATED", () => {
  const r = deriveConsistencyFlag({
    agentActionAtDecision: "MANUAL_REVIEW",
    finalAction: "APPROVE",
  });
  assert.equal(r.flag, "HUMAN_ASSUMED");
  assert.equal(r.reasonRequired, true);
});

test("neither side concluding escalates", () => {
  const r = deriveConsistencyFlag({
    agentActionAtDecision: "MANUAL_REVIEW",
    finalAction: "MANUAL_REVIEW",
  });
  assert.equal(r.flag, "ESCALATED");
  assert.equal(r.reasonRequired, false);
});

test("a deferred decision needs no reason, for every recommendation", () => {
  for (const agent of AGENT_ACTIONS) {
    const r = deriveConsistencyFlag({ agentActionAtDecision: agent, finalAction: null });
    assert.equal(r.flag, "PENDING_DECISION");
    assert.equal(r.reasonRequired, false);
  }
});

test("REASON_MISSING is never produced — a missing reason is rejected before the write", () => {
  for (const agent of AGENT_ACTIONS) {
    for (const final of FINAL_ACTIONS) {
      const { flag } = deriveConsistencyFlag({
        agentActionAtDecision: agent,
        finalAction: final,
      });
      assert.notEqual(flag, "REASON_MISSING");
    }
  }
});

test("flag derivation ignores the reviewer action label", () => {
  // Two DIFFERENT reviewer actions that land on the same conclusion from the
  // same agent suggestion must carry the same flag. On a MANUAL_REVIEW case,
  // ACCEPT concludes nothing (final = MANUAL_REVIEW); a MANUAL_JUDGEMENT whose
  // modal also picks MANUAL_REVIEW reaches the identical conclusion.
  const viaAccept = deriveConsistencyFlag({
    agentActionAtDecision: "MANUAL_REVIEW",
    finalAction: finalActionFor("MANUAL_REVIEW", "ACCEPT"),
  });
  const viaJudgement = deriveConsistencyFlag({
    agentActionAtDecision: "MANUAL_REVIEW",
    finalAction: "MANUAL_REVIEW", // what the UI modal specified
  });
  assert.deepEqual(viaAccept, viaJudgement);
  assert.equal(viaAccept.flag, "ESCALATED");

  // On an APPROVE case, REQUEST_INFO and a MANUAL_JUDGEMENT that picks
  // REQUEST_INFO are different actions with the same conclusion.
  const viaRequestInfo = deriveConsistencyFlag({
    agentActionAtDecision: "APPROVE",
    finalAction: finalActionFor("APPROVE", "REQUEST_INFO"),
  });
  const viaJudgementRequestInfo = deriveConsistencyFlag({
    agentActionAtDecision: "APPROVE",
    finalAction: "REQUEST_INFO", // what the UI modal specified
  });
  assert.deepEqual(viaRequestInfo, viaJudgementRequestInfo);
  assert.equal(viaRequestInfo.flag, "OVERRIDDEN");
});

test("MANUAL_JUDGEMENT on a MANUAL_REVIEW case no longer routes as an escalation", () => {
  const rule = resolveDisposition("MANUAL_REVIEW", "MANUAL_JUDGEMENT");
  assert.notEqual(rule.escalates, true);
  assert.equal(rule.reasonRequired, true);
  // ACCEPT remains the escalation path.
  assert.equal(resolveDisposition("MANUAL_REVIEW", "ACCEPT").escalates, true);
});

test("every permitted reviewer action yields a defined flag", () => {
  const recommendations: RecommendedAction[] = ["APPROVE", "REQUEST_INFO", "MANUAL_REVIEW"];
  for (const rec of recommendations) {
    for (const action of permittedActions(rec)) {
      // HOLD is the only action that concludes nothing.
      const final: RecommendedAction | null = finalActionFor(rec, action);
      const { flag } = deriveConsistencyFlag({
        agentActionAtDecision: rec,
        finalAction: final,
      });
      assert.ok(flag, `no flag for ${rec} + ${action}`);
    }
  }
});

/** Mirrors the API's mapping from reviewer action to human final action. */
function finalActionFor(
  recommendation: RecommendedAction,
  action: ReviewerAction,
): RecommendedAction | null {
  switch (action) {
    case "ACCEPT":
      return recommendation;
    case "REQUEST_INFO":
      return "REQUEST_INFO";
    case "MANUAL_JUDGEMENT":
      return "APPROVE"; // stand-in for the UI-specified conclusion
    case "HOLD":
      return null;
  }
}
