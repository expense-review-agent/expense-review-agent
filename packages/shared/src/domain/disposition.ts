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

import type { RecommendedAction, ReviewerAction, CaseStatus } from "../enums";

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
    MANUAL_JUDGEMENT: {
      resultingStatus: "DISPOSED",
      reasonRequired: true,
      escalates: true,
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
