import { useState } from "react";
import { formatMoney, t } from "@expense-review-agent/shared/browser";
import type { CaseDetail, CaseHistoryScope } from "@expense-review-agent/shared/browser";
import { useCaseList } from "../../api/queries";
import type { PageName } from "../../app/router";
import { CaseHistoryDialog } from "./CaseHistoryDialog";

function Field({
  label,
  value,
  mono = false,
  alert = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="field">
      <div className="field__label">{label}</div>
      <div className={`field__value${mono ? " mono" : ""}${alert ? " text-alert" : ""}`}>
        {value || "—"}
      </div>
    </div>
  );
}

/**
 * 可開啟申請紀錄的欄位。沒有值時（例如案件未記錄部門）**不可點選**——
 * 沒有查詢依據，按了也只會拿到 400。
 */
function HistoryField({
  label,
  value,
  scope,
  onOpen,
}: {
  label: string;
  value: string | null;
  scope: CaseHistoryScope;
  onOpen: (scope: CaseHistoryScope) => void;
}) {
  if (!value) return <Field label={label} value={null} />;
  return (
    <div className="field">
      <div className="field__label">{label}</div>
      <div className="field__value">
        <button
          type="button"
          className="link link--field"
          onClick={() => onOpen(scope)}
          title={t(`caseHistory.open.${scope}`)}
        >
          {value}
        </button>
      </div>
    </div>
  );
}

export function ApplicantInfo({ detail, page }: { detail: CaseDetail; page: PageName }) {
  const { applicant } = detail;
  const [historyScope, setHistoryScope] = useState<CaseHistoryScope | null>(null);
  // 詳情 API 沒有幣別欄位，從列表快取取得；取不到時只顯示數字、不假設是 TWD。
  const list = useCaseList();
  const currency = list.data?.find((item) => item.id === detail.id)?.currency ?? null;
  const amount =
    applicant.amount === null
      ? null
      : currency
        ? formatMoney(applicant.amount, currency)
        : applicant.amount;

  return (
    <section className="section" aria-labelledby="sec-applicant">
      <h3 id="sec-applicant" className="section__title">
        申請資訊
      </h3>
      <div className="fields">
        <HistoryField
          label="申請人"
          value={applicant.name}
          scope="applicant"
          onOpen={setHistoryScope}
        />
        <HistoryField
          label="部門"
          value={applicant.department}
          scope="department"
          onOpen={setHistoryScope}
        />
        <Field label="申請金額" value={amount} mono alert={detail.status === "EXCEPTION"} />
        <Field label="費用類別" value={applicant.category} />
        <Field label="消費日期" value={applicant.expenseDate} />
        <Field label="申請日期" value={applicant.applicationDate} />
      </div>
      {currency && currency !== "TWD" && (
        <p className="notice notice--info">
          幣別為 {currency}。本階段不做匯率換算，金額以原幣顯示。
        </p>
      )}
      {historyScope && (
        <CaseHistoryDialog
          caseId={detail.id}
          scope={historyScope}
          page={page}
          onClose={() => setHistoryScope(null)}
        />
      )}
    </section>
  );
}
