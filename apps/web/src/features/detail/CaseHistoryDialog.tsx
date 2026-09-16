import { buildCaseHistoryView, formatMoney, t } from "@expense-review-agent/shared/browser";
import type { CaseHistoryScope } from "@expense-review-agent/shared/browser";
import { useCaseHistory } from "../../api/queries";
import { caseHref } from "../../app/router";
import type { PageName } from "../../app/router";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/States";
import { useModalBehavior } from "../../components/useModalBehavior";

/**
 * 申請人／部門申請紀錄。
 *
 * 產品邊界：這是**既有案件資料的唯讀清單**。不顯示風險分數、頻率警示，也不做任何
 * 「此人／此部門有問題」的結論性表述——跨案件風險判定屬 M2，不在本階段範圍。
 * 顯示模型由 shared 的 buildCaseHistoryView 產生，該函式刻意沒有任何聚合輸出。
 */
export function CaseHistoryDialog({
  caseId,
  scope,
  page,
  onClose,
}: {
  caseId: string;
  scope: CaseHistoryScope;
  page: PageName;
  onClose: () => void;
}) {
  const history = useCaseHistory(caseId, scope);
  const { containerRef, focusRef } = useModalBehavior<HTMLDivElement, HTMLHeadingElement>(onClose);
  const view = history.data ? buildCaseHistoryView(history.data, formatMoney) : null;

  return (
    <>
      <div className="overlay overlay--nested" onClick={onClose} aria-hidden="true" />
      <div
        ref={containerRef}
        className="modal modal--history"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
      >
        <div className="modal__head">
          <h3 id="history-title" className="modal__title" ref={focusRef} tabIndex={-1}>
            {view ? view.title : t(`caseHistory.open.${scope}`)}
          </h3>
          <button type="button" className="drawer__close" onClick={onClose}>
            ✕ {t("caseHistory.close")}
          </button>
        </div>

        <div className="modal__body">
          {history.isPending ? (
            <SkeletonRows rows={3} />
          ) : history.isError ? (
            <ErrorState
              title={t("caseHistory.error")}
              error={history.error}
              onRetry={() => void history.refetch()}
              inline
            />
          ) : view === null ? null : (
            <>
              <div className="history">
                <div className="history__head">
                  <span>{t("caseHistory.column.caseNumber")}</span>
                  <span>{t("caseHistory.column.applicationDate")}</span>
                  <span>{t("caseHistory.column.amount")}</span>
                  <span>{t("caseHistory.column.classification")}</span>
                  <span>{t("caseHistory.column.caseStatus")}</span>
                </div>
                {view.rows.map((row) =>
                  row.isCurrent ? (
                    // 當前案件只標示、不可點選（點自己沒有意義）
                    <div key={row.id} className="history__row history__row--current">
                      <span className="cell-id">
                        {row.caseNumber}
                        <span className="history__current">{t("caseHistory.current")}</span>
                      </span>
                      <span className="cell-date">{row.applicationDateLabel}</span>
                      <span className="mono">{row.amountLabel}</span>
                      <span>{row.classificationLabel ?? "—"}</span>
                      <span>{row.caseStatusLabel}</span>
                    </div>
                  ) : (
                    <a
                      key={row.id}
                      className="history__row"
                      href={caseHref(row.id, page)}
                      onClick={onClose}
                    >
                      <span className="cell-id">{row.caseNumber}</span>
                      <span className="cell-date">{row.applicationDateLabel}</span>
                      <span className="mono">{row.amountLabel}</span>
                      <span>{row.classificationLabel ?? "—"}</span>
                      <span>{row.caseStatusLabel}</span>
                    </a>
                  ),
                )}
              </div>
              {view.hasNoOtherRecords && <EmptyState title={t("caseHistory.empty")} />}
            </>
          )}
        </div>
      </div>
    </>
  );
}
