import { t } from "@expense-review-agent/shared/browser";
import type { Classification } from "@expense-review-agent/shared/browser";
import { QUEUE_CLASSIFICATIONS } from "./model";
import type { ClassificationFilter } from "./model";

export function FilterChips({
  value,
  onChange,
  counts,
  total,
}: {
  value: ClassificationFilter;
  onChange: (next: ClassificationFilter) => void;
  /** 統計未取得（載入中或失敗）時為 null，chip 不顯示計數，避免把失敗誤顯示成 0。 */
  counts: Record<Classification, number> | null;
  total: number;
}) {
  return (
    <div className="filters" role="group" aria-label="依 Agent 分類篩選">
      <button
        type="button"
        className="chip"
        aria-pressed={value === "ALL"}
        onClick={() => onChange("ALL")}
      >
        全部 {counts && <span className="chip__count">{total}</span>}
      </button>
      {QUEUE_CLASSIFICATIONS.map((c) => (
        <button
          key={c}
          type="button"
          className="chip"
          aria-pressed={value === c}
          onClick={() => onChange(c)}
        >
          <span className={`chip__dot chip__dot--${c}`} aria-hidden="true" />
          {t(`classification.${c}`)} {counts && <span className="chip__count">{counts[c]}</span>}
        </button>
      ))}
    </div>
  );
}
