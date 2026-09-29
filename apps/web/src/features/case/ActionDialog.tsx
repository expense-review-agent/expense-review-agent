import { useId, useState } from "react";
import type { FormEvent } from "react";
import {
  formatTwd,
  isReasonRequired,
  validateWorkflowAction,
} from "@expense-review-agent/shared/browser";
import type {
  CaseDetail,
  ReviewRecord,
  WorkflowAction,
  WorkflowActionResponse,
} from "@expense-review-agent/shared/browser";
import { useWorkflowAction } from "../../api/queries";
import { Modal } from "../../components/Modal";
import { errorMessage } from "../../components/States";

/** 對話框標題與送出按鈕依動作與建議而定（interaction-patterns.md 本輪工作台操作提案）。 */
export function actionTitle(action: WorkflowAction, review: ReviewRecord): string {
  if (action === "REQUEST_INFO") return "退回補件";
  return review.recommendation === "APPROVE" ? "完成初審" : "人工確認通過";
}

/** 退回補件時預先帶入缺少的項目，使用者可再編輯。 */
function defaultReason(action: WorkflowAction, review: ReviewRecord): string {
  if (action !== "REQUEST_INFO" || review.findings.length === 0) return "";
  return `請補充「${review.findings.map((f) => f.title).join("、")}」的相關說明或憑證。`;
}

export function ActionDialog({
  detail,
  review,
  action,
  onClose,
  onDone,
}: {
  detail: CaseDetail;
  review: ReviewRecord;
  action: WorkflowAction;
  onClose: () => void;
  onDone: (response: WorkflowActionResponse) => void;
}) {
  const mutation = useWorkflowAction(detail.caseNumber);
  const [reason, setReason] = useState(() => defaultReason(action, review));
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  const needsReason = isReasonRequired(action, review.recommendation);

  function submit(event: FormEvent) {
    event.preventDefault();
    // 後端是最終把關；這裡用同一份規則提早顯示錯誤。
    const check = validateWorkflowAction({
      latestReview: { key: review.key, recommendation: review.recommendation },
      targetReviewKey: review.key,
      alreadyHandled: detail.latestAction !== null,
      action,
      reason,
    });
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(null);
    mutation.mutate(
      { reviewKey: review.key, action, reason },
      { onSuccess: onDone, onError: (e) => setError(errorMessage(e)) },
    );
  }

  return (
    <Modal title={actionTitle(action, review)} onClose={() => !mutation.isPending && onClose()}>
      <form onSubmit={submit}>
        <p>
          {detail.caseNumber} · {detail.applicantName} · {formatTwd(detail.amount)}
        </p>
        {action === "REQUEST_INFO" ? (
          <p>
            補件對象：{detail.applicantName}（{detail.department}）
          </p>
        ) : (
          <p>確認此案件已完成財務初審。這不代表最終核准或付款。</p>
        )}
        {needsReason && (
          <label className="form-label" htmlFor={fieldId}>
            {action === "REQUEST_INFO" ? "補件內容" : "審核說明"}
            <textarea
              id={fieldId}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="請記錄確認結果與依據"
              rows={4}
              disabled={mutation.isPending}
            />
          </label>
        )}
        <p className="simulation">
          處理結果會寫入審查紀錄並保存。本展示不會發送通知，也不會推進外部流程。
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={mutation.isPending}>
            取消
          </button>
          <button className="primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? "送出中…"
              : action === "REQUEST_INFO"
                ? "確認退回補件"
                : "確認完成"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
