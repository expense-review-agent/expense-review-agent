import { useEffect, useState } from "react";
import { t } from "@expense-review-agent/shared/browser";

const DEBOUNCE_MS = 250;

/**
 * 案件搜尋框。輸入即生效（不需按鈕），但以 250ms debounce 避免每個字元都重算
 * 整份檢視與兩組計數。
 *
 * 輸入框自己保有即時值（打字不會卡），對外只在 debounce 後才送出——
 * 呼叫端拿到的搜尋字串因此與畫面上的計數同步。
 */
export function SearchBox({
  value,
  onChange,
}: {
  /** 已生效的搜尋字串（debounce 後的值）。 */
  value: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  // 外部清除搜尋（例如空狀態的「清除」按鈕）時同步回輸入框
  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onChange(draft), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <div className="search">
      <label className="sr-only" htmlFor="case-search">
        {t("queue.search.label")}
      </label>
      <input
        id="case-search"
        type="search"
        className="search__input"
        placeholder={t("queue.search.placeholder")}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      {draft !== "" && (
        <button
          type="button"
          className="search__clear"
          onClick={() => {
            setDraft("");
            onChange("");
          }}
        >
          {t("queue.search.clear")}
        </button>
      )}
    </div>
  );
}
