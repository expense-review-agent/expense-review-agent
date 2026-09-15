import { formatMoney } from "@expense-review-agent/shared/browser";
import { caseHref } from "../../app/router";
import { useCaseList, useRelatedCases } from "../../api/queries";
import { CaseStatusTag, ClassificationBadge, isClassification } from "../../components/Badges";
import { ErrorState } from "../../components/States";

function relatedAmount(amount: string | null, currency: string | null): string {
  if (amount === null) return "—";
  return currency ? formatMoney(amount, currency) : amount;
}

export function RelatedCases({ caseId }: { caseId: string }) {
  const related = useRelatedCases(caseId, true);
  // 關聯案件 API 沒有幣別，從列表快取取得；取不到時只顯示數字、不假設是 TWD。
  const list = useCaseList();
  const currencyOf = (id: string) => list.data?.find((item) => item.id === id)?.currency ?? null;

  return (
    <section className="section" aria-labelledby="sec-related">
      <h3 id="sec-related" className="section__title">
        關聯案件
      </h3>
      {related.isPending ? (
        <div className="skeleton" style={{ width: "60%" }} />
      ) : related.isError ? (
        <ErrorState error={related.error} onRetry={() => void related.refetch()} inline />
      ) : (
        <div className="related">
          {related.data.map((r) => (
            <div key={r.id} className="related__row">
              <a className="link" href={caseHref(r.id)}>
                {r.caseNumber}
              </a>
              <span className="mono">{relatedAmount(r.amount, currencyOf(r.id))}</span>
              {isClassification(r.status) ? (
                <ClassificationBadge value={r.status} />
              ) : (
                <CaseStatusTag value={r.status} />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
