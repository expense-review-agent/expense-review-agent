import { useState } from "react";
import { formatTwd, sumAmounts, validateBatchComplete } from "@expense-review-agent/shared/browser";
import type { BatchCompleteResponse, CaseListItem } from "@expense-review-agent/shared/browser";
import { useBatchComplete } from "../../api/queries";
import { Modal } from "../../components/Modal";
import { errorMessage } from "../../components/States";

/** 批次完成初審：列出案件與總額；整批皆須為尚未處理的建議通過，否則整批不執行。 */
export function BatchCompleteDialog({
  picked,
  onClose,
  onDone,
}: {
  picked: CaseListItem[];
  onClose: () => void;
  onDone: (response: BatchCompleteResponse) => void;
}) {
  const mutation = useBatchComplete();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    const check = validateBatchComplete(
      picked.map((c) => ({
        caseNumber: c.caseNumber,
        latestRecommendation: c.recommendation,
        handled: c.status !== "PENDING",
      })),
    );
    if (!check.ok) {
      setError(check.message);
      return;
    }
    setError(null);
    mutation.mutate(
      picked.map((c) => c.caseNumber),
      { onSuccess: onDone, onError: (e) => setError(errorMessage(e)) },
    );
  }

  return (
    <Modal title="完成所選初審" onClose={() => !mutation.isPending && onClose()}>
      <p>
        {picked.length} 筆案件 · 合計 {formatTwd(sumAmounts(picked.map((c) => c.amount)))}
      </p>
      <ul>
        {picked.map((c) => (
          <li key={c.caseNumber}>
            {c.caseNumber} · {c.applicantName} · {formatTwd(c.amount)}
          </li>
        ))}
      </ul>
      <p className="simulation">完成財務初審不代表最終核准，不會推進外部流程。</p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" onClick={onClose} disabled={mutation.isPending}>
          取消
        </button>
        <button type="button" className="primary" onClick={confirm} disabled={mutation.isPending}>
          {mutation.isPending ? "送出中…" : "確認完成"}
        </button>
      </div>
    </Modal>
  );
}
