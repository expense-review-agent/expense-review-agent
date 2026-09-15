import type { CheckView } from "@expense-review-agent/shared/browser";
import { caseHref } from "../../app/router";

function CheckIcon({ view }: { view: CheckView }) {
  const variant = view.isSuspicion ? "suspicion" : view.tone;
  return (
    <span className={`check__icon check__icon--${variant}`} aria-hidden="true">
      {view.tone === "ok" ? (
        <svg viewBox="0 0 12 12">
          <path d="M2.5 6.5l2.5 2.5 4.5-5" />
        </svg>
      ) : view.tone === "fail" && !view.isSuspicion ? (
        <svg viewBox="0 0 12 12">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      ) : (
        <svg viewBox="0 0 12 12">
          <path d="M6 3v4M6 9v0" />
        </svg>
      )}
    </span>
  );
}

/**
 * Agent 檢查清單：只呈現白話結論（✅／❌／⚠️）、理由與證據。
 * 不渲染信心度、規則五態原始值、§ 條號（bootstrap design 定案）。
 */
export function CheckList({ checks }: { checks: CheckView[] }) {
  return (
    <ul className="checks">
      {checks.map((view) => {
        const titleVariant = view.isSuspicion ? "suspicion" : view.tone;
        return (
          <li key={view.key} className="check">
            <CheckIcon view={view} />
            <div className="check__body">
              <div>
                <strong className={`check__title check__title--${titleVariant}`}>
                  {view.title}
                </strong>
                <span className="check__status">{view.statusLabel}</span>
                <span className="check__detail"> — {view.detail}</span>
              </div>

              {view.tone !== "ok" &&
                view.evidence.map((e, i) => (
                  <div key={i} className="evidence">
                    {e.snippet && <span>{e.snippet}</span>}
                    {e.relatedCaseId && (
                      <span>
                        {e.snippet ? " " : ""}關聯案件：
                        <a className="link" href={caseHref(e.relatedCaseId)}>
                          {e.relatedCaseNumber ?? "查看"}
                        </a>
                      </span>
                    )}
                  </div>
                ))}

              {view.evidenceMissing && (
                <div className="evidence evidence--missing" role="alert">
                  ⚠ 證據缺漏：此項非通過結論沒有附上證據，請勿依此結論處置並回報系統管理員。
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
