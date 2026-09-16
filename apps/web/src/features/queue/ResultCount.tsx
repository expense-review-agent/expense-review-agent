import { t } from "@expense-review-agent/shared/browser";

/**
 * 結果筆數——畫面上唯一會隨操作變動的數字。
 *
 * 值一律取自 shared 的 `buildQueueView().resultCount`（就是列表長度），
 * 所以它不可能與列表對不上。統計卡片則是固定總覽，不隨篩選或搜尋改變。
 *
 * 列表尚未取得時不顯示數字（不得把載入中或失敗顯示為 0 筆）。
 */
export function ResultCount({ count, loading }: { count: number; loading: boolean }) {
  if (loading) return null;
  return (
    <p className="result-count" role="status">
      {t("queue.resultCount", { count })}
    </p>
  );
}
