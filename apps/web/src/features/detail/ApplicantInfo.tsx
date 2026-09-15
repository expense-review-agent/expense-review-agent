import { formatMoney } from "@expense-review-agent/shared/browser";
import type { CaseDetail } from "@expense-review-agent/shared/browser";
import { useCaseList } from "../../api/queries";

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

export function ApplicantInfo({ detail }: { detail: CaseDetail }) {
  const { applicant } = detail;
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
        <Field label="申請人" value={applicant.name} />
        <Field label="部門" value={applicant.department} />
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
    </section>
  );
}
