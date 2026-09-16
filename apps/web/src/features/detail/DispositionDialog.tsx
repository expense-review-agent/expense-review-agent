import { useId, useState } from "react";
import type { FormEvent } from "react";
import {
  buildDispositionRequest,
  canSubmitDisposition,
  isReasonRequired,
  judgementFinalActions,
} from "@expense-review-agent/shared/browser";
import type {
  DispositionOption,
  DispositionRequest,
  RecommendedAction,
} from "@expense-review-agent/shared/browser";
import { useModalBehavior } from "../../components/useModalBehavior";

/**
 * 處置確認對話框。
 * - 一般動作：確認步驟 + 理由欄（依 shared isReasonRequired 決定必填）。
 * - 人工判斷：另需指定最終結論（通過／補件／人工審核）。
 * 請求一律經 shared buildDispositionRequest 組裝（只有人工判斷帶 finalAction）。
 */
export function DispositionDialog({
  option,
  recommendation,
  runId,
  caseNumber,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  option: DispositionOption;
  recommendation: RecommendedAction;
  runId: string;
  caseNumber: string;
  pending: boolean;
  error: string | null;
  onSubmit: (body: DispositionRequest) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [finalAction, setFinalAction] = useState<RecommendedAction | null>(null);
  const [touched, setTouched] = useState(false);
  const { containerRef, focusRef } = useModalBehavior<HTMLDivElement, HTMLHeadingElement>(
    onCancel,
    {
      escapeEnabled: !pending,
    },
  );
  const ids = useId();

  const draft = { runId, action: option.action, reason, finalAction };
  const judgement = option.opensJudgementDialog;
  const reasonRequired = isReasonRequired(recommendation, option.action, finalAction);
  const canSubmit = canSubmitDisposition(recommendation, draft) && !pending;
  const showReasonError = touched && reasonRequired && !reason.trim();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onSubmit(buildDispositionRequest(draft));
  }

  return (
    <div className="dialog-backdrop" onClick={() => !pending && onCancel()}>
      <div
        ref={containerRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-sub`}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="dialog__head">
            <h2 id={`${ids}-title`} className="dialog__title" ref={focusRef} tabIndex={-1}>
              {option.label}（{caseNumber}）
            </h2>
            <p id={`${ids}-sub`} className="dialog__sub">
              {option.hint}
            </p>
          </div>

          <div className="dialog__body">
            {judgement && (
              <fieldset className="choices">
                <legend className="form-label">
                  最終結論<span className="form-required">*</span>
                </legend>
                {judgementFinalActions().map((choice) => (
                  <label key={choice.value} className="choice">
                    <input
                      type="radio"
                      name={`${ids}-final`}
                      value={choice.value}
                      checked={finalAction === choice.value}
                      onChange={() => setFinalAction(choice.value)}
                      disabled={pending}
                    />
                    {choice.label}
                    {choice.value === recommendation && (
                      <span className="form-optional">（與 Agent 建議相同）</span>
                    )}
                  </label>
                ))}
              </fieldset>
            )}

            <label className="form-label" htmlFor={`${ids}-reason`}>
              理由
              {reasonRequired ? (
                <span className="form-required">*</span>
              ) : (
                <span className="form-optional">（選填）</span>
              )}
            </label>
            <textarea
              id={`${ids}-reason`}
              className="textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              disabled={pending}
              aria-required={reasonRequired}
              aria-invalid={showReasonError}
              placeholder={
                reasonRequired ? "請說明判斷依據，此理由會原樣記入稽核軌跡" : "可補充說明"
              }
            />
            {showReasonError ? (
              <p className="form-help form-help--error">此處置需要填寫理由。</p>
            ) : (
              <p className="form-help">送出後會寫入不可修改的稽核紀錄。</p>
            )}

            {error && (
              <div className="notice notice--error" role="alert">
                <div className="notice__title">處置未送出</div>
                {error}
              </div>
            )}
          </div>

          <div className="dialog__foot">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={onCancel}
              disabled={pending}
            >
              取消
            </button>
            <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
              {pending ? "送出中…" : "確認送出"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
