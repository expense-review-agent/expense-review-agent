import { useMemo, useState } from "react";
import { t } from "@expense-review-agent/shared/browser";
import { useCaseList } from "../../api/queries";
import { StatCards } from "./StatCards";
import { FilterChips } from "./FilterChips";
import { SearchBox } from "./SearchBox";
import { CaseTable } from "./CaseTable";
import { ResultCount } from "./ResultCount";
import { DEFAULT_SORT, buildQueueView, toggleSort } from "./model";
import type { CaseStatusFilter, ClassificationFilter, SortKey, SortState } from "./model";

export function QueuePage({ activeCaseId }: { activeCaseId: string | null }) {
  const [search, setSearch] = useState("");
  const [classification, setClassification] = useState<ClassificationFilter>("ALL");
  const [caseStatus, setCaseStatus] = useState<CaseStatusFilter>("ALL");
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const list = useCaseList();

  // 整個檢視由 shared 的管線算出（基底 → 搜尋 → 兩個維度 → 排序），
  // 所以顯示的計數必然等於列表筆數；這裡不自己組任何篩選或計數邏輯。
  const view = useMemo(
    () => buildQueueView(list.data ?? [], { search, classification, caseStatus }, sort),
    [list.data, search, classification, caseStatus, sort],
  );

  function clearNarrowing() {
    setSearch("");
    setClassification("ALL");
    setCaseStatus("ALL");
  }

  const emptyTitle = view.isSearching
    ? t("queue.empty.noSearchMatch", { term: search.trim() })
    : view.isNarrowed
      ? t("queue.empty.noMatch")
      : t("queue.empty.noCases");

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">案件總覽</h1>
        <p className="page-sub">
          費用申請 — Agent 已完成初審分類，建議僅供參考，最終決定由審核人員做出
        </p>
      </div>

      {/* 列表未取得（載入中或失敗）時不顯示數字，避免把失敗誤顯示為 0；錯誤與重試由下方列表呈現 */}
      <StatCards
        value={classification}
        onChange={setClassification}
        counts={view.classification.counts}
        total={view.classification.total}
        loading={!list.isSuccess}
      />

      <SearchBox value={search} onChange={setSearch} />

      <FilterChips value={caseStatus} onChange={setCaseStatus} />

      {/* 唯一會隨操作變動的數字，緊貼列表上方 */}
      <ResultCount count={view.resultCount} loading={!list.isSuccess} />

      <CaseTable
        items={view.items}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        activeCaseId={activeCaseId}
        sort={sort}
        onSort={(key: SortKey) => setSort((current) => toggleSort(current, key))}
        emptyTitle={emptyTitle}
        emptyAction={
          view.isNarrowed ? { label: t("queue.filter.clear"), onClick: clearNarrowing } : undefined
        }
      />
    </>
  );
}
