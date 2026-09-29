// =============================================================================
// 人工流程動作的合法性（interaction-patterns.md「本輪工作台操作提案」）
//
// - 只能對最新一筆審查紀錄處理；歷史紀錄可查看、不能處理。
// - 同一筆審查紀錄只處理一次，不重複送出。
// - 退回補件一律要有補件內容；非「建議通過」的案件要人工完成初審，須填審核說明。
// - 原始建議保持不變，人工結果另外記錄。
//
// 前後端都用這一份：後端是最終把關，前端用來提早顯示錯誤。
// =============================================================================

import type { CaseStatus, Recommendation, WorkflowAction } from "./vocabulary.ts";

export type WorkflowActionErrorCode = "ALREADY_HANDLED" | "NOT_LATEST_REVIEW" | "REASON_REQUIRED";

export interface WorkflowActionInput {
  latestReview: { key: string; recommendation: Recommendation };
  /** 使用者正在檢視並要處理的審查紀錄。 */
  targetReviewKey: string;
  /** 最新審查紀錄是否已有處理紀錄。 */
  alreadyHandled: boolean;
  action: WorkflowAction;
  reason: string;
}

export type WorkflowActionResult =
  | {
      ok: true;
      reason: string;
      resultingStatus: CaseStatus;
      originalRecommendation: Recommendation;
    }
  | { ok: false; code: WorkflowActionErrorCode; message: string };

const RESULTING_STATUS: Record<WorkflowAction, CaseStatus> = {
  PROCEED: "REVIEW_COMPLETED",
  REQUEST_INFO: "AWAITING_INFO",
};

/** 此動作在此建議下是否必須填寫原因。前端用來決定是否顯示必填欄位。 */
export function isReasonRequired(action: WorkflowAction, recommendation: Recommendation): boolean {
  return action === "REQUEST_INFO" || recommendation !== "APPROVE";
}

export function validateWorkflowAction(input: WorkflowActionInput): WorkflowActionResult {
  if (input.alreadyHandled) {
    return { ok: false, code: "ALREADY_HANDLED", message: "此案件已完成處理。" };
  }
  if (input.targetReviewKey !== input.latestReview.key) {
    return { ok: false, code: "NOT_LATEST_REVIEW", message: "請回到最新初審紀錄後再處理。" };
  }
  const reason = input.reason.trim();
  if (isReasonRequired(input.action, input.latestReview.recommendation) && !reason) {
    return { ok: false, code: "REASON_REQUIRED", message: "請填寫補件內容或審核說明。" };
  }
  return {
    ok: true,
    reason,
    resultingStatus: RESULTING_STATUS[input.action],
    originalRecommendation: input.latestReview.recommendation,
  };
}

export interface BatchCandidate {
  caseNumber: string;
  latestRecommendation: Recommendation;
  handled: boolean;
}

export type BatchValidationResult =
  { ok: true } | { ok: false; code: "EMPTY_OR_DUPLICATE" | "NOT_ELIGIBLE"; message: string };

/** 批次完成初審：整批皆須為尚未處理的「建議通過」，否則整批不執行。 */
export function validateBatchComplete(items: readonly BatchCandidate[]): BatchValidationResult {
  if (!items.length || new Set(items.map((c) => c.caseNumber)).size !== items.length) {
    return { ok: false, code: "EMPTY_OR_DUPLICATE", message: "請選取尚未處理的案件。" };
  }
  if (items.some((c) => c.latestRecommendation !== "APPROVE" || c.handled)) {
    return { ok: false, code: "NOT_ELIGIBLE", message: "僅能批次完成尚未處理的建議通過案件。" };
  }
  return { ok: true };
}
