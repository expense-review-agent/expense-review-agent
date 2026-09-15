import { useMemo, useState } from "react";
import { useCaseList } from "../../api/queries";
import { StatCards } from "./StatCards";
import { FilterChips } from "./FilterChips";
import { CaseTable } from "./CaseTable";
import { classificationCounts, queueItems } from "./model";
import type { ClassificationFilter } from "./model";

export function QueuePage({ activeCaseId }: { activeCaseId: string | null }) {
  const [filter, setFilter] = useState<ClassificationFilter>("ALL");
  const list = useCaseList();

  // 參照案件（REVIEW_CLOSED）不進預設佇列；計數也由這份資料算
  const queue = useMemo(() => queueItems(list.data ?? []), [list.data]);
  const { counts, total } = useMemo(() => classificationCounts(queue), [queue]);
  const visibleItems = useMemo(
    () => (filter === "ALL" ? queue : queue.filter((item) => item.status === filter)),
    [queue, filter],
  );

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">案件總覽</h1>
        <p className="page-sub">
          費用申請 — Agent 已完成初審分類，建議僅供參考，最終決定由審核人員做出
        </p>
      </div>

      {/* 列表未取得（載入中或失敗）時不顯示數字，避免把失敗誤顯示為 0；錯誤與重試由下方列表呈現 */}
      <StatCards counts={counts} total={total} loading={!list.isSuccess} />

      <FilterChips
        value={filter}
        onChange={setFilter}
        counts={list.isSuccess ? counts : null}
        total={total}
      />

      <CaseTable
        items={visibleItems}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        activeCaseId={activeCaseId}
        filtered={filter !== "ALL"}
      />
    </>
  );
}
