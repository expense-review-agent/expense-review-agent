import { groupHumanAnalysis, t } from "@expense-review-agent/shared/browser";
import type { CaseDetail, CheckView } from "@expense-review-agent/shared/browser";

const LABEL_ICON: Record<string, string> = {
  APPROVE: "✅",
  REQUEST_INFO: "📎",
  MANUAL_REVIEW: "🔴",
  HUMAN: "⚪",
};

/** 規範條文原文（組織自訂，原樣顯示、不轉譯），依條文去重。 */
function policyTexts(checks: CheckView[]): string[] {
  const relevant = checks.some((c) => c.tone !== "ok")
    ? checks.filter((c) => c.tone !== "ok")
    : checks;
  return [...new Set(relevant.map((c) => c.policyText).filter((p): p is string => Boolean(p)))];
}

export function SuggestionPanel({ detail, checks }: { detail: CaseDetail; checks: CheckView[] }) {
  const suggestion = detail.suggestion;
  const isHuman = detail.run?.classification === "HUMAN";
  const refs = policyTexts(checks);

  if (!suggestion) {
    return (
      <section className="section" aria-labelledby="sec-suggestion">
        <h3 id="sec-suggestion" className="section__title">
          Agent 建議
        </h3>
        <p className="disclaimer">Agent 本次沒有提出建議，請依檢查結果自行判斷。</p>
      </section>
    );
  }

  const variant = isHuman ? "HUMAN" : suggestion.recommendedAction;
  const reason = t(suggestion.reasonKey, suggestion.reasonParams, "suggestion.fallback");
  const refsBlock =
    refs.length > 0 ? (
      <div className="advice__refs">
        <strong>適用規範：</strong>
        {refs.length === 1 ? (
          refs[0]
        ) : (
          <ul>
            {refs.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    ) : null;

  return (
    <section className="section" aria-labelledby="sec-suggestion">
      <h3 id="sec-suggestion" className="section__title">
        {isHuman ? "Agent 分析" : "Agent 建議"}
      </h3>

      <div className={`advice advice--${variant}`}>
        <div className="advice__label">
          {LABEL_ICON[variant]}{" "}
          {isHuman ? "轉交人工判斷" : t(`recommendedAction.${suggestion.recommendedAction}`)}
        </div>

        {isHuman ? <HumanAnalysis checks={checks} /> : <p className="advice__text">{reason}</p>}

        {refsBlock}
      </div>

      <p className="disclaimer">Agent 建議僅供參考，不是最終決定；處置結論由審核人員做出並承擔。</p>
    </section>
  );
}

function HumanAnalysis({ checks }: { checks: CheckView[] }) {
  const { completed, uncertain } = groupHumanAnalysis(checks);
  return (
    <>
      <div className="advice__text">
        <strong>✅ 已完成檢查：</strong>
        {completed.length === 0 ? (
          <div>（無）</div>
        ) : (
          <ul className="advice__list">
            {completed.map((c) => (
              <li key={c.key}>{c.title}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="advice__text">
        <strong>❓ Agent 無法確定：</strong>
        {uncertain.length === 0 ? (
          <div>（無）</div>
        ) : (
          <ul className="advice__list">
            {uncertain.map((c) => (
              <li key={c.key}>
                {c.title}：{c.detail}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="advice__text">
        <strong>💡 建議：</strong>
        <div>{t("suggestion.HUMAN")} 此案超出 Agent 的判斷範圍。</div>
      </div>
    </>
  );
}
