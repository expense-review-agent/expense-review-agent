import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { ACTION_RESULT_LABEL, RECOMMENDATION_LABEL } from "@expense-review-agent/shared/browser";
import type {
  CaseDetail as CaseDetailData,
  WorkflowAction,
  WorkflowActionResponse,
} from "@expense-review-agent/shared/browser";
import { isNotFound } from "../../api/client";
import { useCaseDetail } from "../../api/queries";
import { formatDateTime } from "../../components/format";
import { RecommendationBadge } from "../../components/RecommendationBadge";
import { ErrorState } from "../../components/States";
import { ActionDialog } from "./ActionDialog";
import { ReviewBody } from "./ReviewBody";

interface Navigation {
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

/** 右側案件詳情：固定 Header、可捲動內容、固定操作 Footer。 */
export function CaseDetail({
  caseNumber,
  onHandled,
  ...nav
}: Navigation & {
  caseNumber: string;
  onHandled: (response: WorkflowActionResponse) => void;
}) {
  const detail = useCaseDetail(caseNumber);

  return (
    <aside className="detail-panel" aria-label={`${caseNumber} 案件詳情`}>
      <Toolbar {...nav} />
      {detail.isPending ? (
        <div className="empty" aria-busy="true">
          <p>正在載入案件詳情…</p>
        </div>
      ) : detail.isError ? (
        isNotFound(detail.error) ? (
          <div className="empty">
            <h2>找不到這筆案件</h2>
            <p>案件編號可能有誤，或案件已不存在。</p>
            <button type="button" onClick={nav.onClose}>
              返回案件列表
            </button>
          </div>
        ) : (
          <ErrorState
            title="案件詳情載入失敗"
            error={detail.error}
            onRetry={() => void detail.refetch()}
          />
        )
      ) : (
        <CaseDetailBody detail={detail.data} onHandled={onHandled} onNext={nav.onNext} />
      )}
    </aside>
  );
}

function Toolbar({ expanded, onToggleExpand, onClose, onPrevious, onNext }: Navigation) {
  return (
    <div className="detail-toolbar">
      <button type="button" onClick={onToggleExpand}>
        {expanded ? "返回並排" : "展開詳情"}
      </button>
      <div>
        <button type="button" onClick={onPrevious}>
          <ChevronLeft size={17} />
          上一筆
        </button>
        <button type="button" onClick={onNext}>
          下一筆
          <ChevronRight size={17} />
        </button>
        <button type="button" onClick={onClose} className="icon-button" aria-label="關閉案件詳情">
          <X size={20} />
        </button>
      </div>
    </div>
  );
}

function CaseDetailBody({
  detail,
  onHandled,
  onNext,
}: {
  detail: CaseDetailData;
  onHandled: (response: WorkflowActionResponse) => void;
  onNext: () => void;
}) {
  // 契約保證至少有一筆審查紀錄（caseDetailSchema reviews.min(1)）
  const latest = detail.reviews[detail.reviews.length - 1];
  const [reviewKey, setReviewKey] = useState(latest.key);
  const [action, setAction] = useState<WorkflowAction | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const review = detail.reviews.find((r) => r.key === reviewKey) ?? latest;
  const historical = review.key !== latest.key;
  const decision = detail.latestAction;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <>
      <header className="case-heading fixed-case-heading">
        <span className="muted">{detail.caseNumber}</span>
        <div>
          <h1 ref={headingRef} tabIndex={-1}>
            {detail.summary}
          </h1>
        </div>
        <RecommendationBadge value={review.recommendation} />
      </header>

      <div className="detail-scroll">
        {historical && (
          <div className="notice">
            正在查看歷史紀錄，無法執行處理。
            <button type="button" onClick={() => setReviewKey(latest.key)}>
              回到最新紀錄
            </button>
          </div>
        )}
        {decision && !historical && (
          <section className="decision">
            <strong>
              <Check size={17} />
              {ACTION_RESULT_LABEL[decision.action]}
            </strong>
            <p>{decision.reason || "已確認初審結果。"}</p>
            <small>
              {decision.actorLabel} · {formatDateTime(decision.createdAt)}
            </small>
          </section>
        )}

        <ReviewBody key={review.key} detail={detail} review={review} />

        <details className="disclosure">
          <summary>初審紀錄（{detail.reviews.length}）</summary>
          {detail.reviewDiff && (
            <p className="review-diff">
              與前次相比：
              {detail.reviewDiff.recommendationChanged
                ? `建議由「${RECOMMENDATION_LABEL[detail.reviewDiff.previousRecommendation]}」改為「${RECOMMENDATION_LABEL[detail.reviewDiff.currentRecommendation]}」`
                : "建議未改變"}
              {detail.reviewDiff.added.length > 0 &&
                `；新增：${detail.reviewDiff.added.map((f) => f.title).join("、")}`}
              {detail.reviewDiff.resolved.length > 0 &&
                `；已解決：${detail.reviewDiff.resolved.map((f) => f.title).join("、")}`}
            </p>
          )}
          {[...detail.reviews].reverse().map((r) => (
            <button
              type="button"
              className={`history-row ${r.key === review.key ? "current" : ""}`}
              key={r.key}
              onClick={() => setReviewKey(r.key)}
              aria-pressed={r.key === review.key}
            >
              <span>
                {formatDateTime(r.reviewedAt)}
                <small>{r.key}</small>
              </span>
              <span>
                {RECOMMENDATION_LABEL[r.recommendation]}
                {r.key === review.key && " · 檢視中"}
              </span>
            </button>
          ))}
        </details>
      </div>

      <footer className="action-bar">
        {historical ? (
          <button type="button" className="primary" onClick={() => setReviewKey(latest.key)}>
            回到最新紀錄
          </button>
        ) : decision ? (
          <>
            <span>{ACTION_RESULT_LABEL[decision.action]}</span>
            <button type="button" onClick={onNext}>
              下一筆案件
              <ChevronRight size={17} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={review.recommendation === "REQUEST_INFO" ? "primary" : ""}
              onClick={() => setAction("REQUEST_INFO")}
            >
              退回補件
            </button>
            <button
              type="button"
              className={review.recommendation === "REQUEST_INFO" ? "" : "primary"}
              onClick={() => setAction("PROCEED")}
            >
              {review.recommendation === "APPROVE" ? "完成初審" : "人工確認通過"}
            </button>
          </>
        )}
      </footer>

      {action && (
        <ActionDialog
          detail={detail}
          review={latest}
          action={action}
          onClose={() => setAction(null)}
          onDone={(response) => {
            setAction(null);
            onHandled(response);
            requestAnimationFrame(() => headingRef.current?.focus());
          }}
        />
      )}
    </>
  );
}
