import { t } from "@expense-review-agent/shared/browser";
import { QUEUE_CASE_STATUSES } from "./model";
import type { CaseStatusFilter } from "./model";

/**
 * 依**處理狀態**篩選。分類篩選在統計卡片上（見 StatCards），這一列不再提供分類 chip。
 *
 * 刻意**不帶計數**：畫面上只留一個會變動的數字（列表上方的「共 N 筆」），
 * 讓每個元素只做一件事——卡片是情勢總覽、chip 是純控制項、結果筆數是唯一的真相。
 */
export function FilterChips({
  value,
  onChange,
}: {
  value: CaseStatusFilter;
  onChange: (next: CaseStatusFilter) => void;
}) {
  return (
    <div className="filters" role="group" aria-label={t("queue.filter.caseStatus.legend")}>
      <button
        type="button"
        className="chip"
        aria-pressed={value === "ALL"}
        onClick={() => onChange("ALL")}
      >
        {t("queue.filter.all")}
      </button>
      {QUEUE_CASE_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          className="chip"
          aria-pressed={value === s}
          onClick={() => onChange(value === s ? "ALL" : s)}
        >
          <span className={`chip__dot chip__dot--status-${s}`} aria-hidden="true" />
          {t(`caseStatus.${s}`)}
        </button>
      ))}
    </div>
  );
}
