// =============================================================================
// Reviewer 處置選項（工作台用）
//
// 動作集合的唯一來源是 domain/disposition.ts 的合法動作矩陣；這裡只替每個合法動作
// 加上顯示資訊，並組裝送往 POST /api/cases/:id/disposition 的請求。
//
// 注意：isReasonRequired() 會呼叫 deriveConsistencyFlag() 取得 reasonRequired，
// 但「只用來判斷理由欄是否必填」。一致性徽章一律顯示後端回傳的固化值，
// UI 不得用這裡算出的 flag 顯示徽章（CLAUDE.md：徽章不得在 UI 端即時重算）。
// =============================================================================

import {
  deriveConsistencyFlag,
  permittedActions,
  resolveDisposition,
} from "../domain/disposition.ts";
import { recommendedActionSchema } from "../enums.ts";
import { t } from "../i18n/format.ts";
import type { RecommendedAction, ReviewerAction } from "../enums.ts";
import type { DispositionRequest } from "../api.ts";

export type DispositionVariant = "primary" | "secondary";

export interface DispositionOption {
  action: ReviewerAction;
  label: string;
  hint: string;
  variant: DispositionVariant;
  /** 開啟「人工判斷」對話框（指定最終結論）；否則開確認對話框。 */
  opensJudgementDialog: boolean;
}

function labelKey(recommendation: RecommendedAction, action: ReviewerAction): string {
  // ACCEPT 在不同建議下語意不同：通過 / 補件 / 轉呈主管（reviewer 不下結論）。
  return action === "ACCEPT" ? `action.ACCEPT.${recommendation}` : `action.${action}`;
}

/** 依 Agent 建議列出合法處置選項；順序沿用矩陣（第一個為「採用建議」）。 */
export function dispositionOptions(recommendation: RecommendedAction): DispositionOption[] {
  return permittedActions(recommendation).map((action) => {
    const key = labelKey(recommendation, action);
    return {
      action,
      label: t(key),
      hint: t(`${key}.hint`),
      variant: action === "ACCEPT" ? "primary" : "secondary",
      opensJudgementDialog: action === "MANUAL_JUDGEMENT",
    };
  });
}

/** 人工判斷 modal 可選的最終結論。 */
export function judgementFinalActions(): Array<{ value: RecommendedAction; label: string }> {
  return recommendedActionSchema.options.map((value) => ({
    value,
    label: t(`finalAction.${value}`),
  }));
}

/**
 * 由 Reviewer 動作推導人工最終結論（與 apps/api ReviewService 的寫入規則一致）：
 * ACCEPT → Agent 建議；REQUEST_INFO → 補件；MANUAL_JUDGEMENT → 指定值；HOLD → null。
 */
export function resolveFinalAction(
  action: ReviewerAction,
  recommendation: RecommendedAction,
  specified: RecommendedAction | null,
): RecommendedAction | null {
  switch (action) {
    case "ACCEPT":
      return recommendation;
    case "REQUEST_INFO":
      return "REQUEST_INFO";
    case "MANUAL_JUDGEMENT":
      return specified;
    case "HOLD":
      return null;
  }
}

/** 此處置是否必須附理由：矩陣規則與徽章算式任一要求即必填（與後端判斷相同）。 */
export function isReasonRequired(
  recommendation: RecommendedAction,
  action: ReviewerAction,
  specifiedFinalAction: RecommendedAction | null = null,
): boolean {
  const rule = resolveDisposition(recommendation, action);
  const { reasonRequired } = deriveConsistencyFlag({
    agentActionAtDecision: recommendation,
    finalAction: resolveFinalAction(action, recommendation, specifiedFinalAction),
  });
  return Boolean(rule.reasonRequired) || reasonRequired;
}

export interface DispositionDraft {
  runId: string;
  action: ReviewerAction;
  reason: string;
  /** 只有 MANUAL_JUDGEMENT 使用；其他動作即使傳入也不會送出。 */
  finalAction: RecommendedAction | null;
}

/**
 * 組裝處置請求。只有 MANUAL_JUDGEMENT 帶 finalAction（且必填）；
 * 其餘動作一律不帶，避免後端 400。理由去除首尾空白，空白則不帶。
 */
export function buildDispositionRequest(draft: DispositionDraft): DispositionRequest {
  const reason = draft.reason.trim();
  const request: DispositionRequest = { runId: draft.runId, action: draft.action };
  if (reason) request.reason = reason;
  if (draft.action === "MANUAL_JUDGEMENT") {
    if (!draft.finalAction) {
      throw new Error("MANUAL_JUDGEMENT requires a finalAction");
    }
    request.finalAction = draft.finalAction;
  }
  return request;
}

/** 草稿是否可送出（必填理由已填、人工判斷已選結論）。 */
export function canSubmitDisposition(
  recommendation: RecommendedAction,
  draft: DispositionDraft,
): boolean {
  if (draft.action === "MANUAL_JUDGEMENT" && !draft.finalAction) return false;
  if (isReasonRequired(recommendation, draft.action, draft.finalAction) && !draft.reason.trim()) {
    return false;
  }
  return true;
}
