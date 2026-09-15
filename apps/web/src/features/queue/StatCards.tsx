import { t } from "@expense-review-agent/shared/browser";
import type { Classification } from "@expense-review-agent/shared/browser";
import { QUEUE_CLASSIFICATIONS } from "./model";

export function StatCards({
  counts,
  total,
  loading,
}: {
  counts: Record<Classification, number>;
  total: number;
  loading: boolean;
}) {
  const value = (n: number) => (loading ? "–" : n);

  return (
    <section className="stats" aria-label="案件統計">
      <div className="stat">
        <div className="stat__label">總案件數</div>
        <div className="stat__value">{value(total)}</div>
        <div className="stat__tag">Agent 已分類</div>
      </div>
      {QUEUE_CLASSIFICATIONS.map((c) => (
        <div key={c} className={`stat stat--${c}`}>
          <div className="stat__label">{t(`classification.${c}`)}</div>
          <div className="stat__value">{value(counts[c])}</div>
          <div className="stat__tag">{t(`classification.${c}.hint`)}</div>
        </div>
      ))}
    </section>
  );
}
