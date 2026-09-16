// =============================================================================
// 費用規範 — Agent 當前檢查依據（唯讀）。
//
// 產品邊界（specs/reviewer-workbench「費用規範唯讀頁面」）：
// - 只說明「每條規則檢查什麼」。不顯示風險分數、跨案件判定或任何指控性結論。
// - 條文原文是組織擁有的內容，原樣印出，不做任何字串處理。
// - 「僅提示疑似」的標註來自後端的 isSuspicionOnly 旗標，**不看 clauseText 的字面**。
//   條文是客戶後台可編輯的，拿它推斷語氣等於讓客戶能關掉產品層 guardrail。
// - 呈現的是「現在」的依據；個案的判斷依據依該案記錄的規範版本回放，不在本頁。
// =============================================================================

import { buildPolicyView, t } from "@expense-review-agent/shared/browser";
import type { PolicyItem } from "@expense-review-agent/shared/browser";
import { usePolicyList } from "../../api/queries";
import { EmptyState, ErrorState, SkeletonRows } from "../../components/States";

function SuspicionNote() {
  return (
    <p className="policy__suspicion" role="note">
      <span className="policy__badge policy__badge--suspicion">
        {t("policy.suspicionOnly.badge")}
      </span>
      {t("policy.suspicionOnly.note")}
    </p>
  );
}

/** 組織條文：規則代碼 + 條文參照 + 條文原文（原樣）。 */
function ClauseCard({ item }: { item: PolicyItem }) {
  return (
    <li className="policy__item">
      <div className="policy__head">
        <span className="policy__code">{item.ruleCode}</span>
        <span className="policy__name">{t(item.nameKey)}</span>
        <span className="policy__ref">{item.clauseRef ?? t("policy.clauseRef.none")}</span>
      </div>
      {/* 組織填寫的原文，不改寫、不翻譯 */}
      <p className="policy__clause">{item.clauseText}</p>
      {item.isSuspicionOnly && <SuspicionNote />}
    </li>
  );
}

/** 產品內建安全邊界：名稱 + 說明，沒有條文欄位。 */
function GuardrailCard({ item }: { item: PolicyItem }) {
  return (
    <li className="policy__item policy__item--builtin">
      <div className="policy__head">
        <span className="policy__code">{item.ruleCode}</span>
        <span className="policy__name">{t(item.nameKey)}</span>
        <span className="policy__badge">{t("policy.builtin.badge")}</span>
      </div>
      <p className="policy__desc">{item.descKey ? t(item.descKey) : t("policy.desc.none")}</p>
      {item.isSuspicionOnly && <SuspicionNote />}
    </li>
  );
}

export function PoliciesPage() {
  const policies = usePolicyList();
  const view = buildPolicyView(policies.data ?? []);

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t("policy.title")}</h1>
        <p className="page-sub">{t("policy.subtitle")}</p>
        {/* 唯讀與版本邊界要寫在畫面上，不靠選單徽章暗示 */}
        <p className="policy__notice">{t("policy.readonly")}</p>
        <p className="policy__notice policy__notice--version">{t("policy.currentVersion")}</p>
      </div>

      {policies.isError ? (
        // 不顯示空清單，避免被誤讀為「沒有任何檢查依據」
        <ErrorState
          title={t("policy.error")}
          error={policies.error}
          onRetry={() => void policies.refetch()}
        />
      ) : policies.isPending ? (
        <div className="policy__section">
          <SkeletonRows rows={5} />
        </div>
      ) : view.total === 0 ? (
        <EmptyState title={t("policy.empty")} />
      ) : (
        <>
          {view.clauses.length > 0 && (
            <section className="policy__section" aria-labelledby="policy-clauses">
              <h2 className="policy__section-title" id="policy-clauses">
                {t("policy.section.clauses")}
              </h2>
              <p className="policy__section-hint">{t("policy.section.clauses.hint")}</p>
              <ul className="policy__list">
                {view.clauses.map((item) => (
                  <ClauseCard key={item.ruleKey} item={item} />
                ))}
              </ul>
            </section>
          )}

          {view.guardrails.length > 0 && (
            <section className="policy__section" aria-labelledby="policy-guardrails">
              <h2 className="policy__section-title" id="policy-guardrails">
                {t("policy.section.guardrails")}
              </h2>
              <p className="policy__section-hint">{t("policy.section.guardrails.hint")}</p>
              <ul className="policy__list">
                {view.guardrails.map((item) => (
                  <GuardrailCard key={item.ruleKey} item={item} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
