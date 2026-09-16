import { useMemo, useState } from "react";
import { t } from "@expense-review-agent/shared/browser";
import { useClosedCaseList } from "../../api/queries";
import { SearchBox } from "../queue/SearchBox";
import { CaseTable } from "../queue/CaseTable";
import { ResultCount } from "../queue/ResultCount";
import { DEFAULT_SORT, buildClosedView, toggleSort } from "../queue/model";
import type { SortKey, SortState } from "../queue/model";

/**
 * 已結案案件頁。資料由後端依流程狀態取回（`caseStatus=REVIEW_CLOSED`），
 * 不從總覽那份資料過濾——總覽刻意排除已結案案件，混在一起就得在每個計數處
 * 小心排除它們，那正是 `/cases/summary` 算錯分類的原因。
 *
 * 搜尋與排序沿用 shared 的同一組函式與 `CaseTable`，兩頁行為因此不可能漂移。
 * 這一頁不顯示分類卡片與處理狀態篩選：流程狀態固定為 REVIEW_CLOSED。
 */
export function ClosedCasesPage({ activeCaseId }: { activeCaseId: string | null }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const list = useClosedCaseList();

  const view = useMemo(
    () => buildClosedView(list.data ?? [], { search }, sort),
    [list.data, search, sort],
  );

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t("closed.title")}</h1>
        <p className="page-sub">{t("closed.subtitle")}</p>
      </div>

      <SearchBox value={search} onChange={setSearch} />

      <ResultCount count={view.resultCount} loading={!list.isSuccess} />

      <CaseTable
        items={view.items}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        activeCaseId={activeCaseId}
        page="closed"
        sort={sort}
        onSort={(key: SortKey) => setSort((current) => toggleSort(current, key))}
        emptyTitle={
          view.isSearching
            ? t("queue.empty.noSearchMatch", { term: search.trim() })
            : t("closed.empty")
        }
        emptyAction={
          view.isSearching
            ? { label: t("queue.search.clear"), onClick: () => setSearch("") }
            : undefined
        }
      />
    </>
  );
}
