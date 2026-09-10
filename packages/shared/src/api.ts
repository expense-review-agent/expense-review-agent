// =============================================================================
// API 契約型別（前後端共用）
// 對應 docs/API_SPEC.md 的 11 支端點。前端與後端都 import 這一份，契約不漂移。
// 骨架保英文（型別名），註解與說明用中文。
// =============================================================================

import { z } from "zod";
import {
  classificationSchema,
  recommendedActionSchema,
  reviewerActionSchema,
  supervisorActionSchema,
  ruleOutcomeSchema,
  caseStatusSchema,
  consistencyFlagSchema,
  confidenceLevelSchema,
} from "./enums";

// ---- 共用小型別 ----
/// 金額一律以字串傳遞，避免 JS number 的浮點誤差（後端由 Prisma Decimal 轉字串）。
export const moneySchema = z.string();

// =============================================================================
// #2 GET /api/cases/summary — 四狀態統計卡片
// =============================================================================
export const caseSummarySchema = z.object({
  total: z.number(),
  // key 可能是分類(NORMAL/EXCEPTION/...)或案件狀態(REVIEW_CLOSED 等)，用寬鬆 string key。
  byStatus: z.record(z.string(), z.number()),
});
export type CaseSummary = z.infer<typeof caseSummarySchema>;

// =============================================================================
// #3 GET /api/cases — 案件列表項
// =============================================================================
export const caseListItemSchema = z.object({
  id: z.string(),
  caseNumber: z.string(),
  applicantName: z.string(),
  summary: z.string(),
  category: z.string().nullable(),
  amount: moneySchema.nullable(),
  currency: z.string(),
  expenseDate: z.string().nullable(), // ISO date (YYYY-MM-DD)
  status: classificationSchema.or(caseStatusSchema),
  recommendedAction: recommendedActionSchema.nullable(),
});
export type CaseListItem = z.infer<typeof caseListItemSchema>;

export const caseListResponseSchema = z.object({
  items: z.array(caseListItemSchema),
});
export type CaseListResponse = z.infer<typeof caseListResponseSchema>;

// =============================================================================
// #4 GET /api/cases/:id — 單案完整詳情
// =============================================================================
export const caseCheckSchema = z.object({
  checkKey: z.string(),
  ruleCode: z.string(),
  outcome: ruleOutcomeSchema,
  isSuspicionOnly: z.boolean(),
  severity: z.string(),
  messageKey: z.string(),
  messageParams: z.record(z.string(), z.unknown()).default({}),
  policyRef: z.string().nullable(),
  policyText: z.string().nullable(),
  evidence: z.array(
    z.object({
      snippet: z.string().nullable(),
      relatedCaseId: z.string().nullable(),
      relatedCaseNumber: z.string().nullable(),
    }),
  ),
});
export type CaseCheck = z.infer<typeof caseCheckSchema>;

export const caseDetailSchema = z.object({
  id: z.string(),
  caseNumber: z.string(),
  summary: z.string(),
  status: classificationSchema.or(caseStatusSchema),
  applicant: z.object({
    name: z.string(),
    department: z.string().nullable(),
    amount: moneySchema.nullable(),
    category: z.string().nullable(),
    expenseDate: z.string().nullable(),
    applicationDate: z.string().nullable(),
  }),
  run: z
    .object({
      runId: z.string(),
      classification: classificationSchema.nullable(),
      recommendedAction: recommendedActionSchema.nullable(),
      confidenceLevel: confidenceLevelSchema.nullable(),
      policyVersion: z.string().nullable(),
      engineVersion: z.string(),
    })
    .nullable(),
  checks: z.array(caseCheckSchema),
  suggestion: z
    .object({
      recommendedAction: recommendedActionSchema,
      reasonKey: z.string(),
      reasonParams: z.record(z.string(), z.unknown()).default({}),
    })
    .nullable(),
});
export type CaseDetail = z.infer<typeof caseDetailSchema>;

// =============================================================================
// #5 GET /api/cases/:id/related — 關聯案件
// =============================================================================
export const relatedCasesResponseSchema = z.object({
  related: z.array(
    z.object({
      id: z.string(),
      caseNumber: z.string(),
      amount: moneySchema.nullable(),
      status: caseStatusSchema.or(classificationSchema),
    }),
  ),
});
export type RelatedCasesResponse = z.infer<typeof relatedCasesResponseSchema>;

// =============================================================================
// #7 GET /api/policies — 費用規範列表
// =============================================================================
export const policyItemSchema = z.object({
  ruleKey: z.string(),
  ruleCode: z.string(),
  name: z.string(),
  clauseRef: z.string().nullable(),
  clauseText: z.string(),
  category: z.string().nullable(),
  params: z.record(z.string(), z.unknown()).default({}),
  violationHandling: z.string().nullable(),
});
export type PolicyItem = z.infer<typeof policyItemSchema>;

export const policyListResponseSchema = z.object({
  items: z.array(policyItemSchema),
});
export type PolicyListResponse = z.infer<typeof policyListResponseSchema>;

// =============================================================================
// #8/#9 Runs — 非同步 Agent 初審
// =============================================================================
export const runStatusSchema = z.enum(["PENDING", "RUNNING", "SUCCEEDED", "FAILED"]);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const createRunResponseSchema = z.object({
  runId: z.string(),
  status: runStatusSchema,
});
export type CreateRunResponse = z.infer<typeof createRunResponseSchema>;

export const runStateResponseSchema = z.object({
  runId: z.string(),
  status: runStatusSchema,
  caseId: z.string(),
  classification: classificationSchema.nullable(),
});
export type RunStateResponse = z.infer<typeof runStateResponseSchema>;

// =============================================================================
// #10 POST /api/cases/:id/disposition — Reviewer 處置
// =============================================================================
export const dispositionRequestSchema = z.object({
  runId: z.string(),
  action: reviewerActionSchema,
  reason: z.string().optional(),
  /// 人工最終結論。`MANUAL_JUDGEMENT` 時必填（由 UI modal 指定通過／補件／人工審核）；
  /// 其餘動作不得帶——結論由動作本身決定，靜默忽略會讓前端誤以為自己指定的值生效了。
  finalAction: recommendedActionSchema.optional(),
});
export type DispositionRequest = z.infer<typeof dispositionRequestSchema>;

export const dispositionResponseSchema = z.object({
  dispositionId: z.string(),
  resultingStatus: caseStatusSchema,
  consistencyFlag: consistencyFlagSchema,
});
export type DispositionResponse = z.infer<typeof dispositionResponseSchema>;

// =============================================================================
// #11 POST /api/cases/:id/supervisor-review — 主管稽核
// =============================================================================
export const supervisorReviewRequestSchema = z.object({
  action: supervisorActionSchema,
  comment: z.string().optional(),
});
export type SupervisorReviewRequest = z.infer<typeof supervisorReviewRequestSchema>;

// =============================================================================
// #6 GET /api/cases/:id/audit — 稽核軌跡
// =============================================================================
export const auditEventSchema = z.object({
  seq: z.number(),
  type: z.string(),
  actorLabel: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  hash: z.string(),
});
export type AuditEventDto = z.infer<typeof auditEventSchema>;

export const auditTrailResponseSchema = z.object({
  events: z.array(auditEventSchema),
  chainValid: z.boolean(),
});
export type AuditTrailResponse = z.infer<typeof auditTrailResponseSchema>;
