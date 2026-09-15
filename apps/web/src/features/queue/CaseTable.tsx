import { formatMoney } from "@expense-review-agent/shared/browser";
import type { CaseListItem } from "@expense-review-agent/shared/browser";
import { caseHref } from "../../app/router";
import { CaseStatusTag, ClassificationBadge, RecommendationTag } from "../../components/Badges";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/States";

/** YYYY-MM-DD → MM-DD（字串處理，不經 Date 以免時區位移）。 */
function shortDate(iso: string | null): string {
  return iso ? iso.slice(5, 10) : "—";
}

export function CaseTable({
  items,
  loading,
  error,
  onRetry,
  activeCaseId,
  filtered,
}: {
  items: CaseListItem[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  activeCaseId: string | null;
  filtered: boolean;
}) {
  if (error) {
    // 不顯示空列表，避免被誤解為「沒有案件」
    return <ErrorState title="案件列表載入失敗" error={error} onRetry={onRetry} />;
  }

  return (
    <div className="table">
      <div className="table__scroll">
        <div className="table__head">
          <span>案件編號</span>
          <span>申請人 / 說明</span>
          <span>費用類別</span>
          <span>金額</span>
          <span>日期</span>
          <span>Agent 分類</span>
          <span>建議</span>
          <span>處理狀態</span>
        </div>

        {loading ? (
          <SkeletonRows />
        ) : items.length === 0 ? (
          <EmptyState title={filtered ? "此分類目前沒有案件" : "目前沒有待審案件"} />
        ) : (
          items.map((item) => {
            const isException = item.status === "EXCEPTION";
            return (
              <a
                key={item.id}
                href={caseHref(item.id)}
                className={`table__row${item.id === activeCaseId ? " table__row--active" : ""}`}
                aria-label={`開啟案件 ${item.caseNumber}`}
                aria-current={item.id === activeCaseId ? "true" : undefined}
              >
                <span className="cell-id">{item.caseNumber}</span>
                <span className="cell-name" title={`${item.applicantName} ｜ ${item.summary}`}>
                  {item.applicantName} ｜ {item.summary || "—"}
                </span>
                <span>{item.category ?? "—"}</span>
                <span className={`cell-amount${isException ? " text-alert" : ""}`}>
                  {formatMoney(item.amount, item.currency)}
                </span>
                <span className="cell-date">{shortDate(item.expenseDate)}</span>
                <span>
                  <ClassificationBadge value={item.status} />
                </span>
                <span>
                  <RecommendationTag value={item.recommendedAction} />
                </span>
                <span>
                  <CaseStatusTag value={item.caseStatus} />
                </span>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
