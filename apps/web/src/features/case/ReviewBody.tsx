import { useState } from "react";
import { AlertTriangle, Check, ClipboardList, HelpCircle, Minus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DIMENSION_LABEL,
  DIMENSION_METHOD,
  RECOMMENDATION_LABEL,
  checkRowView,
  formatTwd,
  recommendationCardBody,
  sumAmounts,
} from "@expense-review-agent/shared/browser";
import type { CaseDetail, CheckTone, ReviewRecord } from "@expense-review-agent/shared/browser";
import { Modal } from "../../components/Modal";
import { toneOf } from "../../components/RecommendationBadge";

const TONE_ICON: Record<CheckTone, LucideIcon> = {
  ok: Check,
  issue: X,
  missing: AlertTriangle,
  unknown: HelpCircle,
  na: Minus,
};

function RecommendationCard({ review }: { review: ReviewRecord }) {
  const rule = review.findings[0]?.ruleText;
  return (
    <section
      className={`recommendation-card ${toneOf(review.recommendation)}`}
      aria-labelledby="recommendation-heading"
    >
      <h2 id="recommendation-heading">{RECOMMENDATION_LABEL[review.recommendation]}</h2>
      <p>{recommendationCardBody(review)}</p>
      {rule && <p className="recommendation-rule">適用規範：{rule}</p>}
    </section>
  );
}

/**
 * 申請資訊、審查結果與比對、處理建議。
 * 顯示的是「這一筆」審查紀錄：憑證只列當次審查時已提供的，歷史紀錄不顯示後來補入的附件。
 */
export function ReviewBody({ detail, review }: { detail: CaseDetail; review: ReviewRecord }) {
  const lines = detail.lines;
  const [lineKey, setLineKey] = useState(lines[0]?.key ?? "");
  const [zoom, setZoom] = useState(false);
  const line = lines.find((l) => l.key === lineKey) ?? lines[0];
  const available = new Set(review.receiptKeys);
  const evidence = line
    ? detail.receipts.filter((r) => line.receiptKeys.includes(r.key) && available.has(r.key))
    : [];

  return (
    <>
      <section className="application-section" aria-labelledby="application-heading">
        <h2 id="application-heading">申請資訊</h2>
        <h3>基本資訊</h3>
        <dl className="application-facts">
          <div>
            <dt>申請人</dt>
            <dd>{detail.applicantName}</dd>
          </div>
          <div>
            <dt>員工編號</dt>
            <dd>{detail.employeeId ?? "未提供"}</dd>
          </div>
          <div>
            <dt>申請部門</dt>
            <dd>{detail.department}</dd>
          </div>
          <div>
            <dt>申請日期</dt>
            <dd>{detail.submittedAt ?? "未提供"}</dd>
          </div>
        </dl>

        <h3>費用明細</h3>
        <div className="line-table-wrap">
          <table className="line-table">
            <thead>
              <tr>
                <th>消費日期</th>
                <th>費用類型</th>
                <th className="amount-cell">未稅</th>
                <th className="amount-cell">稅額</th>
                <th className="amount-cell">總計</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr
                  key={l.key}
                  className={l.key === line?.key ? "selected-row" : ""}
                  onClick={() => setLineKey(l.key)}
                >
                  <td>{l.expenseDate}</td>
                  <td>
                    <button
                      type="button"
                      className="case-link"
                      onClick={() => setLineKey(l.key)}
                      aria-pressed={l.key === line?.key}
                    >
                      {l.category}
                    </button>
                  </td>
                  {/* 未提供時明示，不推定稅率或將未提供顯示為零 */}
                  <td className="amount-cell">
                    {l.netAmount === null ? "未提供" : formatTwd(l.netAmount)}
                  </td>
                  <td className="amount-cell">
                    {l.taxAmount === null ? "未提供" : formatTwd(l.taxAmount)}
                  </td>
                  <td className="amount-cell">{formatTwd(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="application-facts summary-facts">
          <div>
            <dt>用途說明</dt>
            <dd>{detail.description}</dd>
          </div>
          <div>
            <dt>申請總額</dt>
            <dd className="application-total">{formatTwd(detail.amount)}</dd>
          </div>
        </dl>
        <h3>付款資訊</h3>
        <dl className="application-facts">
          <div>
            <dt>支付方式</dt>
            <dd>{detail.paymentMethod ?? "未提供"}</dd>
          </div>
        </dl>
      </section>

      <section className="audit-section" aria-labelledby="audit-heading">
        <h2 id="audit-heading">審查結果與比對</h2>
        <div className="audit-grid">
          <div className="check-list" role="list">
            {review.checks.map((check) => {
              const view = checkRowView(check, review.findings);
              const Icon = TONE_ICON[view.tone];
              return (
                <div
                  className={`finding-row check-${view.tone}`}
                  key={check.dimension}
                  role="listitem"
                >
                  <Icon size={16} className="check-icon" aria-hidden="true" />
                  <div className="check-body">
                    <div className="check-heading">
                      <strong>{DIMENSION_LABEL[check.dimension]}</strong>
                      <span className="check-result-label">{view.label}</span>
                    </div>
                    <p className="check-summary">
                      {view.text}
                      {view.figures && <span className="check-figures"> — {view.figures}</span>}
                    </p>
                    {view.finding?.relatedCaseNumber && (
                      <p className="check-related">
                        關聯案件：{view.finding.relatedCaseNumber}
                        。相同欄位是待確認訊號，不代表已認定重複報銷。
                      </p>
                    )}
                    <details className="audit-basis">
                      <summary>規則依據</summary>
                      <p>{DIMENSION_METHOD[check.dimension]}</p>
                      {view.finding && <p>{view.finding.ruleText}</p>}
                    </details>
                  </div>
                </div>
              );
            })}
          </div>

          <details className="evidence-section" aria-label="憑證預覽">
            <summary>憑證比對</summary>
            {line && (
              <div className="evidence-body">
                {evidence.length > 0 && (
                  <div className="evidence-heading">
                    <button type="button" onClick={() => setZoom(true)}>
                      放大檢視
                    </button>
                  </div>
                )}
                <div className="evidence-tabs">
                  {lines.map((l) => (
                    <button
                      type="button"
                      key={l.key}
                      aria-pressed={l.key === line.key}
                      onClick={() => setLineKey(l.key)}
                    >
                      {l.category}
                    </button>
                  ))}
                </div>
                <p className="line-description">
                  {line.expenseDate} · {line.description}
                </p>
                <dl className="receipt-comparison">
                  <div>
                    <dt>申報金額</dt>
                    <dd>{formatTwd(line.amount)}</dd>
                  </div>
                  <div>
                    <dt>憑證金額</dt>
                    <dd>
                      {evidence.length
                        ? formatTwd(sumAmounts(evidence.map((e) => e.amount)))
                        : "未提供"}
                    </dd>
                  </div>
                </dl>
                {evidence.length ? (
                  evidence.map((e) => (
                    <figure key={e.key}>
                      {e.imagePath && (
                        <img
                          className="receipt"
                          src={e.imagePath}
                          alt={`${e.vendor}模擬憑證，金額${formatTwd(e.amount)}`}
                        />
                      )}
                      <figcaption>
                        {e.key} · {e.vendor}
                      </figcaption>
                    </figure>
                  ))
                ) : (
                  <div className="no-evidence">
                    <ClipboardList size={28} aria-hidden="true" />
                    <strong>未提供{line.category}憑證</strong>
                  </div>
                )}
              </div>
            )}
          </details>
        </div>
      </section>

      <RecommendationCard review={review} />

      {zoom && line && (
        <Modal title={`${line.category}憑證`} onClose={() => setZoom(false)}>
          {evidence.map(
            (e) =>
              e.imagePath && (
                <img
                  key={e.key}
                  className="receipt enlarged"
                  src={e.imagePath}
                  alt={`${e.vendor}模擬憑證，金額${formatTwd(e.amount)}`}
                />
              ),
          )}
        </Modal>
      )}
    </>
  );
}
