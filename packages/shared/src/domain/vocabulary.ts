// =============================================================================
// 審查詞彙（唯一來源）
//
// 值用英文、必須與 apps/api/prisma/schema.prisma 的 enum 一一對應（見 enum-parity 測試）。
// 顯示文案在 presentation/labels.ts。這個檔案不依賴 zod，seed 可以直接 import。
// =============================================================================

/** 案件層級的審查建議。只有三種（specs/review-case.md 5.5）。 */
export const RECOMMENDATIONS = ["APPROVE", "REQUEST_INFO", "MANUAL_REVIEW"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

/** 四個審查面向（specs/review-case.md 5.2）。 */
export const REVIEW_DIMENSIONS = [
  "EVIDENCE_MATCH",
  "CORPORATE_POLICY",
  "COMPLIANCE",
  "RISK_SIGNAL",
] as const;
export type ReviewDimension = (typeof REVIEW_DIMENSIONS)[number];

/** 每項檢核的結果：通過／未通過／無法判斷／不適用（specs/review-case.md 5.3）。 */
export const CHECK_STATUSES = ["PASS", "FAIL", "UNDETERMINED", "NOT_APPLICABLE"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];

/**
 * 發現項目的性質（specs/review-case.md 5.4）。
 * MISSING 是可補正的缺漏；ANOMALY 是已確認的不一致、不符合或疑似異常；
 * UNDETERMINED 是系統無法可靠判斷，必須與 ANOMALY 區分呈現（4.7）。
 */
export const FINDING_KINDS = ["MISSING", "ANOMALY", "UNDETERMINED"] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

/**
 * 本輪人工可執行的流程動作。ESCALATE 已在 Product Brief 定義，
 * 但本輪 Prototype 不以轉交作為主要動作，等對應 Slice 收斂再加入。
 */
export const WORKFLOW_ACTIONS = ["PROCEED", "REQUEST_INFO"] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

/** 案件處理進度。 */
export const CASE_STATUSES = ["PENDING", "AWAITING_INFO", "REVIEW_COMPLETED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

/** 稽核紀錄的執行者類型（interaction-patterns.md 稽核紀錄模式）。 */
export const ACTOR_TYPES = ["AGENT", "HUMAN", "SYSTEM"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/** 審查紀錄的來源。PRESET = 預置的模擬分析結果，不是引擎實際算出的。 */
export const REVIEW_SOURCES = ["PRESET"] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export const AUDIT_EVENT_TYPES = ["CASE_CREATED", "REVIEW_RECORDED", "WORKFLOW_ACTION"] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
