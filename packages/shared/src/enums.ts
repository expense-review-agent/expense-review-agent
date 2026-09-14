import { z } from "zod";

// =============================================================================
// Canonical review vocabulary — MUST match apps/api/prisma/schema.prisma enums.
// The parity test (see __tests__/enum-parity) asserts one-to-one correspondence;
// if you add/remove a value here or in the schema, update both and the test.
//
// NOTE: The former ADOPT / OVERRIDE reviewActionSchema has been removed
// (BREAKING). Use reviewerActionSchema below.
// =============================================================================

/// 四分類（Agent 對案件的判定）
export const classificationSchema = z.enum(["NORMAL", "EXCEPTION", "MISSING", "HUMAN"]);
export type Classification = z.infer<typeof classificationSchema>;

/// 三桶建議（EXCEPTION 與 HUMAN 皆對應 MANUAL_REVIEW）
export const recommendedActionSchema = z.enum(["APPROVE", "REQUEST_INFO", "MANUAL_REVIEW"]);
export type RecommendedAction = z.infer<typeof recommendedActionSchema>;

/// Reviewer 處置動作（F7 / AC2）
export const reviewerActionSchema = z.enum(["ACCEPT", "REQUEST_INFO", "MANUAL_JUDGEMENT", "HOLD"]);
export type ReviewerAction = z.infer<typeof reviewerActionSchema>;

/// 主管稽核動作（F10 / AC6）
export const supervisorActionSchema = z.enum([
  "APPROVE",
  "RETURN_TO_REVIEWER",
  "MARK_REVIEWED",
  "FLAG_CONCERN",
  "ANNOTATE",
]);
export type SupervisorAction = z.infer<typeof supervisorActionSchema>;

/// 規則判定五態
export const ruleOutcomeSchema = z.enum(["PASS", "FAIL", "GATED", "ABSTAIN", "PENDING_HUMAN"]);
export type RuleOutcome = z.infer<typeof ruleOutcomeSchema>;

/// 案件狀態機
export const caseStatusSchema = z.enum([
  "DRAFT",
  "QUEUED",
  "AWAITING_INFO",
  "DISPOSED",
  "REVIEW_CLOSED",
]);
export type CaseStatus = z.infer<typeof caseStatusSchema>;

/// 一致性徽章（由 finalAction 與 agentActionAtDecision 計算後固化寫入）
/// 算式見 domain/disposition.ts 的 deriveConsistencyFlag()——那裡是唯一實作。
export const consistencyFlagSchema = z.enum([
  "CONSISTENT",
  "OVERRIDDEN",
  "HUMAN_ASSUMED",
  "ESCALATED",
  "REASON_MISSING",
  "PENDING_DECISION",
]);
export type ConsistencyFlag = z.infer<typeof consistencyFlagSchema>;

export const confidenceLevelSchema = z.enum(["HIGH", "MEDIUM", "LOW", "NONE"]);
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;
