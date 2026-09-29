import { Sparkles } from "lucide-react";
import { CASE_STATUS_LABEL, formatTwd } from "@expense-review-agent/shared/browser";
import type { CaseListItem, CaseStatus } from "@expense-review-agent/shared/browser";
import { RecommendationBadge } from "../../components/RecommendationBadge";

const STATUS_TONE: Record<CaseStatus, string> = {
  PENDING: "",
  AWAITING_INFO: "tone-1",
  REVIEW_COMPLETED: "tone-0",
};

/**
 * 案件列表：一列一案件。案件編號與申報項目凍結在左側；Agent 產出的欄位以主色圖示標示；
 * 處理狀態只在「全部」分頁顯示（其他分頁本身已代表處理狀態）。
 */
export function CaseTable({
  items,
  selectedCaseNumber,
  showStatus,
  batchMode,
  eligible,
  checked,
  onToggleAll,
  onToggle,
  onSelect,
}: {
  items: CaseListItem[];
  selectedCaseNumber: string | null;
  showStatus: boolean;
  batchMode: boolean;
  eligible: CaseListItem[];
  checked: string[];
  onToggleAll: (checked: boolean) => void;
  onToggle: (caseNumber: string, checked: boolean) => void;
  onSelect: (caseNumber: string) => void;
}) {
  const stickyIdLeft = batchMode ? 40 : 0;
  const stickySummaryLeft = stickyIdLeft + 130;
  const picked = eligible.filter((c) => checked.includes(c.caseNumber));

  return (
    <table>
      <thead>
        <tr>
          {batchMode && (
            <th className="selection-cell sticky-col" style={{ left: 0 }}>
              <input
                type="checkbox"
                aria-label="選取所有可處理案件"
                checked={eligible.length > 0 && picked.length === eligible.length}
                disabled={eligible.length === 0}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </th>
          )}
          <th className="sticky-col" style={{ left: stickyIdLeft }}>
            案件編號
          </th>
          <th className="sticky-col sticky-col-end" style={{ left: stickySummaryLeft }}>
            申報項目
          </th>
          <th>
            <span className="icon-label ai-marker">
              <Sparkles size={14} aria-hidden="true" />
              初審建議
            </span>
          </th>
          <th>
            <span className="icon-label ai-marker">
              <Sparkles size={14} aria-hidden="true" />
              初審結果
            </span>
          </th>
          <th className="category-col">費用類型</th>
          <th>申請部門</th>
          <th>申請人</th>
          <th className="amount-cell">申請金額</th>
          {showStatus && <th>處理狀態</th>}
          <th>申請日期</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const selectable = eligible.some((c) => c.caseNumber === item.caseNumber);
          return (
            <tr
              key={item.caseNumber}
              className={selectedCaseNumber === item.caseNumber ? "selected-row" : ""}
              onClick={() => onSelect(item.caseNumber)}
            >
              {batchMode && (
                <td
                  className="selection-cell sticky-col"
                  style={{ left: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    aria-label={`選取 ${item.caseNumber}`}
                    disabled={!selectable}
                    checked={selectable && checked.includes(item.caseNumber)}
                    onChange={(e) => onToggle(item.caseNumber, e.target.checked)}
                  />
                </td>
              )}
              <td className="sticky-col" style={{ left: stickyIdLeft }}>
                <button
                  type="button"
                  id={`open-${item.caseNumber}`}
                  className="case-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(item.caseNumber);
                  }}
                  aria-label={`開啟 ${item.caseNumber} ${item.applicantName}`}
                  aria-expanded={selectedCaseNumber === item.caseNumber}
                >
                  {item.caseNumber}
                </button>
              </td>
              <td
                className="summary-cell sticky-col sticky-col-end"
                style={{ left: stickySummaryLeft }}
              >
                <span className="clamp-2" title={item.summary}>
                  {item.summary}
                </span>
              </td>
              <td>
                <RecommendationBadge value={item.recommendation} />
              </td>
              <td className="summary-cell">
                <span className="clamp-2" title={item.agentSummary}>
                  {item.agentSummary}
                </span>
              </td>
              <td className="category-col">{item.category}</td>
              <td>{item.department}</td>
              <td>{item.applicantName}</td>
              <td className="amount-cell">{formatTwd(item.amount)}</td>
              {showStatus && (
                <td>
                  <span className={`badge ${STATUS_TONE[item.status]}`}>
                    <span />
                    {CASE_STATUS_LABEL[item.status]}
                  </span>
                </td>
              )}
              <td>{item.submittedAt ?? "未提供"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
