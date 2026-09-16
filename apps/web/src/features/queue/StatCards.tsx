import { t } from "@expense-review-agent/shared/browser";
import type { Classification } from "@expense-review-agent/shared/browser";
import { QUEUE_CLASSIFICATIONS } from "./model";
import type { ClassificationFilter } from "./model";

/**
 * 統計卡片本身就是分類篩選控制項——原本卡片與 chip 顯示同一組數字、同一個維度，
 * 使用者看到兩排重複的東西。
 *
 * 「總案件數」卡片即「全部」選項且預設選取，所以**任何時候恰有一張卡片是選取狀態**，
 * 不會出現四張都沒選、使用者無從判斷當前範圍的空窗。
 *
 * 數字是**固定總覽**（待審案件的分類分佈），不隨處理狀態篩選或搜尋改變——儀表板數字
 * 一直跳動會讓人不敢信任它。當前結果的筆數由列表上方的「共 N 筆」負責，
 * 那是畫面上唯一會動的數字。
 */
export function StatCards({
  value,
  onChange,
  counts,
  total,
  loading,
}: {
  value: ClassificationFilter;
  onChange: (next: ClassificationFilter) => void;
  counts: Record<Classification, number>;
  total: number;
  /** 列表未取得（載入中或失敗）時不顯示數字，避免把失敗誤顯示為 0。 */
  loading: boolean;
}) {
  const value_ = (n: number) => (loading ? "–" : n);

  return (
    <section className="stats" role="group" aria-label={t("queue.filter.classification.legend")}>
      <button
        type="button"
        className="stat stat--btn"
        aria-pressed={value === "ALL"}
        onClick={() => onChange("ALL")}
      >
        <div className="stat__label">{t("queue.filter.all.hint")}</div>
        <div className="stat__value">{value_(total)}</div>
        <div className="stat__tag">{t("queue.filter.all")}</div>
      </button>
      {QUEUE_CLASSIFICATIONS.map((c) => (
        <button
          key={c}
          type="button"
          className={`stat stat--btn stat--${c}`}
          aria-pressed={value === c}
          // 再點一次同一張卡片＝取消篩選，選取狀態回到「全部」
          onClick={() => onChange(value === c ? "ALL" : c)}
        >
          <div className="stat__label">{t(`classification.${c}`)}</div>
          <div className="stat__value">{value_(counts[c])}</div>
          <div className="stat__tag">{t(`classification.${c}.hint`)}</div>
        </button>
      ))}
    </section>
  );
}
