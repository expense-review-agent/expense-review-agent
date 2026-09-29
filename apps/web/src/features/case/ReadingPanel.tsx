import { useState } from "react";
import { AlertTriangle, Check, HelpCircle, Minus, ScanText, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  FIELD_LABEL,
  FIELD_STATUS_LABEL,
  RECEIPT_FIELDS,
  amountCheckSummary,
  formatCentsTwd,
  formatTwd,
} from "@expense-review-agent/shared/browser";
import type {
  CaseDetail,
  FieldStatus,
  ReceiptReadingDto,
} from "@expense-review-agent/shared/browser";
import { useReadings, useStartReading } from "../../api/queries";
import { formatDateTime } from "../../components/format";
import { errorMessage } from "../../components/States";

type AmountStatus = NonNullable<ReceiptReadingDto["amountChecks"]>[number]["result"]["status"];

const AMOUNT_TONE: Record<AmountStatus, { tone: string; Icon: LucideIcon }> = {
  MATCH: { tone: "ok", Icon: Check },
  MISMATCH: { tone: "issue", Icon: X },
  MISSING_EVIDENCE: { tone: "missing", Icon: AlertTriangle },
  UNDETERMINED: { tone: "unknown", Icon: HelpCircle },
};

const FIELD_ICON: Record<FieldStatus, LucideIcon> = {
  RECOGNIZED: Check,
  UNREADABLE: HelpCircle,
  NOT_ON_RECEIPT: Minus,
};

/** 讀到的值：金額以新台幣格式顯示，其餘照原樣。 */
function displayValue(field: (typeof RECEIPT_FIELDS)[number], value: string): string {
  return field === "totalAmount" ? formatTwd(value) : value;
}

/**
 * AI 讀取憑證（specs/receipt-reading.md）。
 * 讀取結果與預置的審查建議分開呈現，不改寫檢查清單或處理建議（4.9）。
 * 歷史審查紀錄不提供讀取（4.11）；沒有憑證的案件不提供讀取（4.7）。
 */
export function ReadingPanel({ detail, historical }: { detail: CaseDetail; historical: boolean }) {
  const readings = useReadings(detail.caseNumber);
  const start = useStartReading(detail.caseNumber);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (detail.receipts.length === 0) return null;

  const list = readings.data ?? [];
  const latest = list[0];
  const running = latest?.status === "RUNNING" || start.isPending;
  const shown = list.find((r) => r.id === selectedId) ?? latest;
  const lineLabel = (lineKey: string) => {
    const line = detail.lines.find((l) => l.key === lineKey);
    return line
      ? `${line.expenseDate} ${line.category}（申請 ${formatTwd(line.amount)}）`
      : lineKey;
  };

  return (
    <details className="evidence-section reading-section" aria-label="AI 讀取憑證">
      <summary>AI 讀取憑證</summary>
      <div className="evidence-body">
        <p className="reading-note">
          <ScanText size={15} aria-hidden="true" />由 AI
          讀取憑證內容並以讀到的金額核對。讀取結果需人工確認，不會改變上方的審查建議與處理進度。
        </p>

        {!historical && (
          <div className="reading-actions">
            <button
              type="button"
              className={latest ? "" : "primary"}
              disabled={running}
              onClick={() => {
                setSelectedId(null);
                start.mutate();
              }}
            >
              {running ? "讀取中…" : latest ? "重新讀取" : "讀取憑證"}
            </button>
          </div>
        )}

        {start.isError && (
          <p role="alert" className="error">
            {errorMessage(start.error)}
          </p>
        )}
        {readings.isError && (
          <p role="alert" className="error">
            無法取得讀取紀錄：{errorMessage(readings.error)}
          </p>
        )}

        <div aria-live="polite">
          {running && <p className="reading-status">正在讀取 {detail.receipts.length} 張憑證…</p>}
        </div>

        {shown && shown.status !== "RUNNING" && (
          <ReadingResult
            reading={shown}
            lineLabel={lineLabel}
            imageOf={(key) => detail.receipts.find((r) => r.key === key)?.imagePath ?? null}
          />
        )}

        {list.length > 1 && (
          <div className="reading-history">
            <h3>讀取紀錄（{list.length}）</h3>
            {list.map((r) => (
              <button
                type="button"
                key={r.id}
                className={`history-row ${r.id === shown?.id ? "current" : ""}`}
                aria-pressed={r.id === shown?.id}
                onClick={() => setSelectedId(r.id)}
              >
                <span>{formatDateTime(r.startedAt)}</span>
                <span>
                  {r.status === "SUCCEEDED"
                    ? "讀取完成"
                    : r.status === "FAILED"
                      ? "讀取失敗"
                      : "讀取中"}
                  {r.id === shown?.id && " · 檢視中"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function ReadingResult({
  reading,
  lineLabel,
  imageOf,
}: {
  reading: ReceiptReadingDto;
  lineLabel: (lineKey: string) => string;
  /** 顯示 AI 實際讀取的那張圖檔，讓使用者對照 */
  imageOf: (receiptKey: string) => string | null;
}) {
  const meta = (
    <p className="reading-meta">
      {formatDateTime(reading.startedAt)} · {reading.actorLabel} · {reading.model} · 讀取指示{" "}
      {reading.promptVersion}
    </p>
  );

  if (reading.status === "FAILED") {
    return (
      <div className="reading-failed" role="alert">
        <strong>讀取失敗</strong>
        <p>{reading.failureReason}</p>
        {meta}
      </div>
    );
  }

  return (
    <div className="reading-result">
      <h3>以讀取金額核對（E-01）</h3>
      <div className="check-list" role="list">
        {(reading.amountChecks ?? []).map(({ lineKey, result }) => {
          const { tone, Icon } = AMOUNT_TONE[result.status];
          const figures =
            result.status === "MISMATCH" &&
            result.applicationCents !== undefined &&
            result.evidenceCents !== undefined
              ? `申請 ${formatCentsTwd(result.applicationCents)}，讀取 ${formatCentsTwd(result.evidenceCents)}`
              : null;
          return (
            <div key={lineKey} className={`finding-row check-${tone}`} role="listitem">
              <Icon size={16} className="check-icon" aria-hidden="true" />
              <div className="check-body">
                <div className="check-heading">
                  <strong>{lineLabel(lineKey)}</strong>
                  <span className="check-result-label">{amountCheckSummary(result)}</span>
                </div>
                <p className="check-summary">
                  {result.reason}
                  {figures && <span className="check-figures"> — {figures}</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {Object.entries(reading.extractions ?? {}).map(([receiptKey, extraction]) => (
        <figure key={receiptKey} className="reading-receipt">
          {imageOf(receiptKey) && (
            <img
              className="receipt"
              src={imageOf(receiptKey) ?? ""}
              alt={`${receiptKey} 模擬憑證`}
            />
          )}
          <figcaption>{receiptKey} · AI 讀取結果，需人工確認</figcaption>
          <table className="line-table reading-fields">
            <thead>
              <tr>
                <th>欄位</th>
                <th>讀到的內容</th>
                <th>辨識狀態</th>
              </tr>
            </thead>
            <tbody>
              {RECEIPT_FIELDS.map((field) => {
                const { status, value } = extraction[field];
                const Icon = FIELD_ICON[status];
                return (
                  <tr key={field} className={`field-${status.toLowerCase()}`}>
                    <td>{FIELD_LABEL[field]}</td>
                    <td>{value === null ? "—" : displayValue(field, value)}</td>
                    <td>
                      <span className="field-status">
                        <Icon size={14} aria-hidden="true" />
                        {FIELD_STATUS_LABEL[status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </figure>
      ))}
      {meta}
    </div>
  );
}
