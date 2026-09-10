// =============================================================================
// Disposition matrix — the SINGLE source of the legal reviewer-action matrix.
// Both apps/web and apps/api MUST import from here; neither re-implements it.
// Owned by @ChichiTung (see CODEOWNERS: /packages/shared/src/domain/).
//
// Maps an agent recommendation -> permitted reviewer actions, and each
// (recommendation, action) -> resulting case status.
//
// Decided rules (see CLAUDE.md 已定案的決策):
//   - APPROVE       + ACCEPT           -> DISPOSED
//   - REQUEST_INFO  + ACCEPT           -> AWAITING_INFO
//   - MANUAL_REVIEW + ACCEPT           -> DISPOSED, but semantics = 轉呈主管，
//                                          reviewer 不下最終結論（escalate）
//   - MANUAL_JUDGEMENT / REQUEST_INFO / HOLD are context-permitted alternatives.
//   - HOLD keeps the case in QUEUED (no forward movement).
// =============================================================================

import type { RecommendedAction, ReviewerAction, CaseStatus, ConsistencyFlag } from "../enums";

/** Whether accepting this recommendation concludes the case or escalates it. */
export interface DispositionRule {
  /** Case status after this (recommendation, action) pair is recorded. */
  resultingStatus: CaseStatus;
  /**
   * True when ACCEPT on a MANUAL_REVIEW recommendation must escalate to a
   * supervisor rather than let the reviewer record a final approve/deny.
   */
  escalates?: boolean;
  /** Free-text reason is required for this pairing (override / human judgement). */
  reasonRequired?: boolean;
}

/**
 * Legal actions per recommendation. The FIRST action in each list is the
 * "accept the agent's suggestion as-is" action; the rest are permitted
 * alternatives a reviewer may choose.
 */
export const DISPOSITION_MATRIX: Record<
  RecommendedAction,
  Partial<Record<ReviewerAction, DispositionRule>>
> = {
  APPROVE: {
    ACCEPT: { resultingStatus: "DISPOSED" },
    REQUEST_INFO: { resultingStatus: "AWAITING_INFO", reasonRequired: true },
    MANUAL_JUDGEMENT: { resultingStatus: "DISPOSED", reasonRequired: true },
    HOLD: { resultingStatus: "QUEUED" },
  },
  REQUEST_INFO: {
    ACCEPT: { resultingStatus: "AWAITING_INFO" },
    MANUAL_JUDGEMENT: { resultingStatus: "DISPOSED", reasonRequired: true },
    HOLD: { resultingStatus: "QUEUED" },
  },
  MANUAL_REVIEW: {
    // Accepting a MANUAL_REVIEW recommendation escalates — reviewer does not
    // record a final approve/deny conclusion.
    ACCEPT: { resultingStatus: "DISPOSED", escalates: true },
    REQUEST_INFO: { resultingStatus: "AWAITING_INFO", reasonRequired: true },
    // NOT an escalation: the human states a final action, so the human owns the
    // conclusion (deriveConsistencyFlag returns HUMAN_ASSUMED). Escalation is
    // reserved for ACCEPT, where neither side concludes.
    MANUAL_JUDGEMENT: {
      resultingStatus: "DISPOSED",
      reasonRequired: true,
    },
    HOLD: { resultingStatus: "QUEUED" },
  },
};

/** Returns true if `action` is legal for the given agent `recommendation`. */
export function isLegalDisposition(
  recommendation: RecommendedAction,
  action: ReviewerAction,
): boolean {
  return Boolean(DISPOSITION_MATRIX[recommendation]?.[action]);
}

/**
 * Resolves the disposition rule for a (recommendation, action) pair.
 * Throws if the action is not legal for that recommendation — callers should
 * validate with `isLegalDisposition` first (or catch) so illegal actions never
 * silently mutate case state.
 */
export function resolveDisposition(
  recommendation: RecommendedAction,
  action: ReviewerAction,
): DispositionRule {
  const rule = DISPOSITION_MATRIX[recommendation]?.[action];
  if (!rule) {
    throw new Error(`Illegal reviewer action "${action}" for recommendation "${recommendation}".`);
  }
  return rule;
}

/** All reviewer actions permitted for a given recommendation. */
export function permittedActions(recommendation: RecommendedAction): ReviewerAction[] {
  return Object.keys(DISPOSITION_MATRIX[recommendation]) as ReviewerAction[];
}

// =============================================================================
// Consistency flag derivation — the SINGLE source of the badge algorithm.
// Both apps/web and apps/api MUST import from here; neither re-implements it.
//
// The flag is a PURE function of two inputs frozen at decision time:
//   agentActionAtDecision  — what the agent recommended when the human decided
//   finalAction            — what the human actually concluded (null = deferred)
//
// The reviewer action label (ACCEPT / MANUAL_JUDGEMENT / ...) is deliberately
// NOT an input: two dispositions reaching the same conclusion from the same
// agent suggestion must carry the same flag, however the reviewer got there.
//
// Algorithm (mirrors the ConsistencyFlag doc comment in schema.prisma):
//
//   final = null                                   -> PENDING_DECISION
//   agent = null,          final ≠ null            -> HUMAN_ASSUMED
//   agent ≠ MANUAL_REVIEW, final = agent           -> CONSISTENT
//   agent ≠ MANUAL_REVIEW, final ≠ agent           -> OVERRIDDEN     (reason)
//   agent = MANUAL_REVIEW, final ≠ MANUAL_REVIEW   -> HUMAN_ASSUMED  (reason)
//   agent = MANUAL_REVIEW, final = MANUAL_REVIEW   -> ESCALATED
//
// REASON_MISSING is NOT produced here. A missing reason is rejected before the
// write (the API returns 400), so it never reaches the database. That value is
// reserved for out-of-band paths such as data import.
// =============================================================================

export interface ConsistencyFlagInput {
  /** The agent recommendation captured at decision time. */
  agentActionAtDecision: RecommendedAction | null;
  /** The human conclusion. `null` means the reviewer deferred without concluding. */
  finalAction: RecommendedAction | null;
}

export interface ConsistencyFlagResult {
  flag: ConsistencyFlag;
  /** True when this pairing must carry a free-text reason. */
  reasonRequired: boolean;
}

/**
 * Derives the consistency flag for a disposition. The result is meant to be
 * frozen onto the record at write time — never recomputed for display, since a
 * later policy revision would otherwise flip historical badges.
 */
export function deriveConsistencyFlag(input: ConsistencyFlagInput): ConsistencyFlagResult {
  const { agentActionAtDecision: agent, finalAction: final } = input;

  // Reviewer deferred — neither side reached a conclusion, case stays queued.
  if (final === null) {
    return { flag: "PENDING_DECISION", reasonRequired: false };
  }

  // Agent reached no conclusion at all: the human carries the judgement alone.
  if (agent === null) {
    return { flag: "HUMAN_ASSUMED", reasonRequired: true };
  }

  if (agent === "MANUAL_REVIEW") {
    // Agent declined to conclude. Human concluding = human assumed the call;
    // human also declining = escalate to a supervisor.
    return final === "MANUAL_REVIEW"
      ? { flag: "ESCALATED", reasonRequired: false }
      : { flag: "HUMAN_ASSUMED", reasonRequired: true };
  }

  // Agent reached a definite conclusion — agreement or override.
  return final === agent
    ? { flag: "CONSISTENT", reasonRequired: false }
    : { flag: "OVERRIDDEN", reasonRequired: true };
}
