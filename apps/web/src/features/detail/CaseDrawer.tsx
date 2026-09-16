import { useMemo } from "react";
import { relatedCasesFromChecks, toCheckView } from "@expense-review-agent/shared/browser";
import type { CaseDetail } from "@expense-review-agent/shared/browser";
import { isNotFound } from "../../api/client";
import type { PageName } from "../../app/router";
import { useCaseDetail } from "../../api/queries";
import { CaseStatusTag, ClassificationBadge } from "../../components/Badges";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/States";
import { useModalBehavior } from "../../components/useModalBehavior";
import { ApplicantInfo } from "./ApplicantInfo";
import { CheckList } from "./CheckList";
import { SuggestionPanel } from "./SuggestionPanel";
import { RelatedCases } from "./RelatedCases";
import { DispositionPanel } from "./DispositionPanel";

export function CaseDrawer({
  caseId,
  page,
  onClose,
}: {
  caseId: string;
  /** 當前頁面：關聯案件與申請紀錄的連結要留在同一頁。 */
  page: PageName;
  onClose: () => void;
}) {
  const detail = useCaseDetail(caseId);
  const { containerRef, focusRef } = useModalBehavior<HTMLElement, HTMLHeadingElement>(onClose);

  const data = detail.data;
  const title = data ? `${data.caseNumber} ｜ ${data.summary || "（無說明）"}` : "案件詳情";

  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <aside
        ref={containerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="drawer__head">
          <div>
            <h2 id="drawer-title" className="drawer__title" ref={focusRef} tabIndex={-1}>
              {title}
            </h2>
            {data && (
              <div className="drawer__meta">
                <ClassificationBadge value={data.status} />
                <CaseStatusTag value={data.caseStatus} />
              </div>
            )}
          </div>
          <button type="button" className="drawer__close" onClick={onClose}>
            ✕ 關閉
          </button>
        </div>

        <div className="drawer__body">
          {detail.isPending ? (
            <SkeletonRows rows={6} />
          ) : detail.isError ? (
            isNotFound(detail.error) ? (
              <EmptyState title="找不到案件">此案件不存在或已被移除。</EmptyState>
            ) : (
              <ErrorState
                title="案件詳情載入失敗"
                error={detail.error}
                onRetry={() => void detail.refetch()}
                inline
              />
            )
          ) : (
            <CaseDetailBody detail={detail.data} page={page} />
          )}
        </div>
      </aside>
    </>
  );
}

function CaseDetailBody({ detail, page }: { detail: CaseDetail; page: PageName }) {
  const checks = useMemo(() => detail.checks.map(toCheckView), [detail.checks]);
  const relatedFromEvidence = useMemo(() => relatedCasesFromChecks(checks), [checks]);

  return (
    <>
      <ApplicantInfo detail={detail} page={page} />

      {detail.run === null ? (
        <section className="section">
          <EmptyState title="此案件尚無 Agent 初審結果">
            沒有 Agent 檢查與建議可以顯示，也無法在此處置。
          </EmptyState>
        </section>
      ) : (
        <>
          <section className="section" aria-labelledby="sec-checks">
            <h3 id="sec-checks" className="section__title">
              Agent 檢查結果
            </h3>
            {checks.length === 0 ? (
              <p className="disclaimer">本次初審沒有檢查項目紀錄。</p>
            ) : (
              <CheckList checks={checks} />
            )}
          </section>

          <SuggestionPanel detail={detail} checks={checks} />

          {relatedFromEvidence.length > 0 && <RelatedCases caseId={detail.id} page={page} />}

          <DispositionPanel detail={detail} />
        </>
      )}
    </>
  );
}
