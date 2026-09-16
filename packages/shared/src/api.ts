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
  /// 申請當時的部門（時點快照）。來源系統未提供時為 null，語意是「未記錄」。
  department: z.string().nullable(),
  summary: z.string(),
  category: z.string().nullable(),
  amount: moneySchema.nullable(),
  currency: z.string(),
  expenseDate: z.string().nullable(), // ISO date (YYYY-MM-DD)
  /// 申請日期：列表的日期欄與排序依據（消費日期仍保留，於詳情抽屜顯示）。
  applicationDate: z.string().nullable(), // ISO date (YYYY-MM-DD)
  status: classificationSchema.or(caseStatusSchema),
  /// 案件流程狀態（QUEUED / AWAITING_INFO / DISPOSED ...），與上方 Agent 分類分開。
  /// 前端依此決定是否顯示處置按鈕。
  caseStatus: caseStatusSchema,
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
  /// 案件流程狀態，與 Agent 分類分開（見 caseListItemSchema）。
  caseStatus: caseStatusSchema,
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
  /// 最新一筆 Reviewer 處置（append-only 紀錄的唯讀投影）。尚未被處置時為 null。
  /// `consistencyFlag` 是處置寫入時固化的值，前端與後端都不得在讀取時重算。
  disposition: z
    .object({
      actorName: z.string(),
      decidedAt: z.string(), // ISO datetime
      action: reviewerActionSchema,
      consistencyFlag: consistencyFlagSchema,
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
// GET /api/cases/:id/history?scope=applicant|department — 申請人／部門申請紀錄
//
// 以案件為查詢起點（申請人沒有穩定 id，姓名放進 URL 會遇到編碼與同名歧義）。
// 唯讀投影：只有既有案件欄位，沒有風險分數、頻率統計或任何結論性標記——
// 跨案件風險判定屬 M2，不在此回應內。
// =============================================================================
export const caseHistoryScopeSchema = z.enum(["applicant", "department"]);
export type CaseHistoryScope = z.infer<typeof caseHistoryScopeSchema>;

export const caseHistoryItemSchema = z.object({
  id: z.string(),
  caseNumber: z.string(),
  applicationDate: z.string().nullable(), // ISO date (YYYY-MM-DD)
  amount: moneySchema.nullable(),
  currency: z.string(),
  status: classificationSchema.or(caseStatusSchema),
  caseStatus: caseStatusSchema,
  /// 是否為查詢起點的那筆案件（清單一律包含起點案件並標示）。
  isCurrent: z.boolean(),
});
export type CaseHistoryItem = z.infer<typeof caseHistoryItemSchema>;

export const caseHistoryResponseSchema = z.object({
  scope: caseHistoryScopeSchema,
  /// 查詢所依據的值（申請人姓名或部門名稱），供前端顯示標題。
  subject: z.string(),
  items: z.array(caseHistoryItemSchema),
});
export type CaseHistoryResponse = z.infer<typeof caseHistoryResponseSchema>;

// =============================================================================
// #7 GET /api/policies — 費用規範列表
// =============================================================================
export const policyItemSchema = z.object({
  ruleKey: z.string(),
  ruleCode: z.string(),
  /// 規則名稱的 i18n key（例 "rule.R1.name"）。欄位名刻意帶 Key：這裡存的一直是
  /// 識別碼而非顯示文案，叫 name 會誘導呼叫端直接印出 "rule.R1.name"。
  nameKey: z.string(),
  /// 規則說明的 i18n key；型錄未提供說明時為 null。
  descKey: z.string().nullable(),
  /// 組織條文的參照與原文。產品內建的安全邊界沒有條文可引用，兩者皆為 null——
  /// 不以系統文案偽造成條文（見 specs/review-api「規範列表」）。
  clauseRef: z.string().nullable(),
  clauseText: z.string().nullable(),
  category: z.string().nullable(),
  params: z.record(z.string(), z.unknown()).default({}),
  violationHandling: z.string().nullable(),
  /// true = 本規則只能表述為「疑似」（R7 重複、R8 拆單）。取自產品擁有的 RuleDefinition，
  /// **不得**由組織可編輯的 clauseText 字面推斷——那會讓組織改寫條文就關掉 guardrail。
  isSuspicionOnly: z.boolean(),
  /// true = 產品內建的安全邊界檢查，非組織條文。
  isGuardrail: z.boolean(),
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
