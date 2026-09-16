import { formatMoney, t } from "@expense-review-agent/shared/browser";
import type { CaseListItem } from "@expense-review-agent/shared/browser";
import { caseHref } from "../../app/router";
import type { PageName } from "../../app/router";
import { CaseStatusTag, ClassificationBadge, RecommendationTag } from "../../components/Badges";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/States";
import type { SortKey, SortState } from "./model";

/** YYYY-MM-DD → MM-DD（字串處理，不經 Date 以免時區位移）。 */
function shortDate(iso: string | null): string {
  return iso ? iso.slice(5, 10) : "—";
}

/**
 * 可排序的欄位標題。排序入口只出現在列表實際顯示的欄位上——
 * 排序畫面上不存在的欄位會讓使用者無法理解結果。
 */
function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      className={`th-sort${active ? " th-sort--active" : ""}`}
      // aria-sort 屬於欄位標題本身，讓螢幕閱讀器報出當前排序方向
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
      aria-label={active ? t(`queue.sort.${sortKey}.${sort.direction}`) : label}
      onClick={() => onSort(sortKey)}
    >
      {label}
      <span className="th-sort__arrow" aria-hidden="true">
        {active ? (sort.direction === "asc" ? "▲" : "▼") : "⇅"}
      </span>
    </button>
  );
}

export function CaseTable({
  items,
  loading,
  error,
  onRetry,
  activeCaseId,
  page = "queue",
  sort,
  onSort,
  emptyTitle,
  emptyAction,
}: {
  items: CaseListItem[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  activeCaseId: string | null;
  /** 案件連結要保留當前頁面，抽屜關閉後才會回到同一頁。 */
  page?: PageName;
  sort: SortState;
  onSort: (key: SortKey) => void;
  emptyTitle: string;
  /** 空狀態的脫離入口（清除篩選／搜尋），沒有篩選時不給。 */
  emptyAction?: { label: string; onClick: () => void } | undefined;
}) {
  if (error) {
    // 不顯示空列表，避免被誤解為「沒有案件」
    return <ErrorState title="案件列表載入失敗" error={error} onRetry={onRetry} />;
  }

  return (
    <div className="table">
      <div className="table__scroll">
        <div className="table__head">
          <SortableHeader
            label={t("queue.sort.caseNumber")}
            sortKey="caseNumber"
            sort={sort}
            onSort={onSort}
          />
          <span>申請人 / 說明</span>
          <span>費用類別</span>
          <span>金額</span>
          <SortableHeader
            label={t("queue.sort.applicationDate")}
            sortKey="applicationDate"
            sort={sort}
            onSort={onSort}
          />
          <span>Agent 分類</span>
          <span>建議</span>
          <span>處理狀態</span>
        </div>

        {loading ? (
          <SkeletonRows />
        ) : items.length === 0 ? (
          <EmptyState title={emptyTitle} action={emptyAction} />
        ) : (
          items.map((item) => {
            const isException = item.status === "EXCEPTION";
            return (
              <a
                key={item.id}
                href={caseHref(item.id, page)}
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
                {/* 日期欄為申請日期，與排序入口一致；消費日期在詳情抽屜顯示 */}
                <span className="cell-date">{shortDate(item.applicationDate)}</span>
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
