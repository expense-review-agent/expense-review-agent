// =============================================================================
// API 契約（前後端共用）。對應 docs/API_SPEC.md。
// 前端以這些 schema 驗證回應；後端的回傳型別也取自這裡，契約不漂移。
// =============================================================================

import { z } from "zod";
import {
  ACTOR_TYPES,
  CASE_STATUSES,
  CHECK_STATUSES,
  FINDING_KINDS,
  RECOMMENDATIONS,
  REVIEW_DIMENSIONS,
  REVIEW_SOURCES,
  WORKFLOW_ACTIONS,
} from "./domain/vocabulary.ts";

export const recommendationSchema = z.enum(RECOMMENDATIONS);
export const reviewDimensionSchema = z.enum(REVIEW_DIMENSIONS);
export const checkStatusSchema = z.enum(CHECK_STATUSES);
export const findingKindSchema = z.enum(FINDING_KINDS);
export const workflowActionSchema = z.enum(WORKFLOW_ACTIONS);
export const caseStatusSchema = z.enum(CASE_STATUSES);
export const actorTypeSchema = z.enum(ACTOR_TYPES);
export const reviewSourceSchema = z.enum(REVIEW_SOURCES);

/** 金額一律以字串傳遞（後端由 Prisma Decimal 轉字串），避免浮點誤差。 */
export const moneySchema = z.string();
/** YYYY-MM-DD */
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ---- 審查紀錄 ---------------------------------------------------------------

export const checkResultSchema = z.object({
  dimension: reviewDimensionSchema,
  status: checkStatusSchema,
  summary: z.string(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

export const findingSchema = z.object({
  key: z.string(),
  dimension: reviewDimensionSchema,
  kind: findingKindSchema,
  title: z.string(),
  explanation: z.string(),
  ruleCode: z.string().nullable(),
  ruleText: z.string(),
  comparison: z.array(z.tuple([z.string(), z.string()])),
  relatedCaseNumber: z.string().nullable(),
  nextStep: z.string().nullable(),
});
export type Finding = z.infer<typeof findingSchema>;

export const reviewRecordSchema = z.object({
  key: z.string(),
  reviewedAt: z.string(), // ISO datetime
  recommendation: recommendationSchema,
  /** PRESET = 預置的模擬分析結果，不是引擎實際算出的。 */
  source: reviewSourceSchema,
  checks: z.array(checkResultSchema),
  findings: z.array(findingSchema),
  /** 當次審查時已提供的憑證。歷史紀錄不能顯示後來補入的附件。 */
  receiptKeys: z.array(z.string()),
});
export type ReviewRecord = z.infer<typeof reviewRecordSchema>;

export const reviewDiffSchema = z.object({
  previousRecommendation: recommendationSchema,
  currentRecommendation: recommendationSchema,
  recommendationChanged: z.boolean(),
  added: z.array(z.object({ key: z.string(), title: z.string() })),
  resolved: z.array(z.object({ key: z.string(), title: z.string() })),
});

// ---- 案件 -------------------------------------------------------------------

export const receiptSchema = z.object({
  key: z.string(),
  vendor: z.string(),
  amount: moneySchema,
  issueDate: isoDateSchema,
  hasTaxId: z.boolean(),
  /** 展示用模擬憑證圖檔（前端 public 下的路徑），不是真實文件。 */
  imagePath: z.string().nullable(),
});
export type Receipt = z.infer<typeof receiptSchema>;

export const expenseLineSchema = z.object({
  key: z.string(),
  category: z.string(),
  description: z.string(),
  expenseDate: isoDateSchema,
  amount: moneySchema,
  /** 未提供時為 null，不由總額反推，也不顯示為零。 */
  netAmount: moneySchema.nullable(),
  taxAmount: moneySchema.nullable(),
  receiptKeys: z.array(z.string()),
});
export type ExpenseLine = z.infer<typeof expenseLineSchema>;

export const workflowActionRecordSchema = z.object({
  action: workflowActionSchema,
  actorType: actorTypeSchema,
  actorLabel: z.string(),
  reason: z.string(),
  originalRecommendation: recommendationSchema,
  reviewKey: z.string(),
  resultingStatus: caseStatusSchema,
  createdAt: z.string(), // ISO datetime
});
export type WorkflowActionRecord = z.infer<typeof workflowActionRecordSchema>;

// GET /api/cases
export const caseListItemSchema = z.object({
  caseNumber: z.string(),
  summary: z.string(),
  applicantName: z.string(),
  department: z.string(),
  category: z.string(),
  amount: moneySchema,
  currency: z.string(),
  submittedAt: isoDateSchema.nullable(),
  recommendation: recommendationSchema,
  /** 初審結果欄的一句話摘要（取自最新審查紀錄的 Finding）。 */
  agentSummary: z.string(),
  status: caseStatusSchema,
});
export type CaseListItem = z.infer<typeof caseListItemSchema>;

export const caseListResponseSchema = z.object({ items: z.array(caseListItemSchema) });
export type CaseListResponse = z.infer<typeof caseListResponseSchema>;

// GET /api/cases/:caseNumber
export const caseDetailSchema = z.object({
  caseNumber: z.string(),
  applicantName: z.string(),
  employeeId: z.string().nullable(),
  department: z.string(),
  category: z.string(),
  amount: moneySchema,
  currency: z.string(),
  expenseDate: isoDateSchema,
  submittedAt: isoDateSchema.nullable(),
  summary: z.string(),
  description: z.string(),
  paymentMethod: z.string().nullable(),
  /** 展示情境名稱（模擬資料用），例如「疑似重複申報」。 */
  scenario: z.string(),
  status: caseStatusSchema,
  lines: z.array(expenseLineSchema),
  receipts: z.array(receiptSchema),
  /** 由舊到新；最後一筆是最新審查紀錄。 */
  reviews: z.array(reviewRecordSchema).min(1),
  /** 最新審查紀錄的人工處理紀錄；尚未處理時為 null。 */
  latestAction: workflowActionRecordSchema.nullable(),
  /** 最新與前一次審查的差異；只有一筆審查紀錄時為 null。 */
  reviewDiff: reviewDiffSchema.nullable(),
});
export type CaseDetail = z.infer<typeof caseDetailSchema>;

// POST /api/cases/:caseNumber/actions
export const workflowActionRequestSchema = z.object({
  reviewKey: z.string(),
  action: workflowActionSchema,
  reason: z.string().default(""),
});
export type WorkflowActionRequest = z.input<typeof workflowActionRequestSchema>;

export const workflowActionResponseSchema = z.object({
  caseNumber: z.string(),
  status: caseStatusSchema,
  action: workflowActionRecordSchema,
});
export type WorkflowActionResponse = z.infer<typeof workflowActionResponseSchema>;

// POST /api/cases/batch-complete
export const batchCompleteRequestSchema = z.object({
  caseNumbers: z.array(z.string()),
});
export type BatchCompleteRequest = z.infer<typeof batchCompleteRequestSchema>;

export const batchCompleteResponseSchema = z.object({
  results: z.array(z.object({ caseNumber: z.string(), status: caseStatusSchema })),
});
export type BatchCompleteResponse = z.infer<typeof batchCompleteResponseSchema>;

// GET /api/cases/:caseNumber/audit
export const auditEventSchema = z.object({
  seq: z.number(),
  type: z.string(),
  actorType: actorTypeSchema,
  actorLabel: z.string(),
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
