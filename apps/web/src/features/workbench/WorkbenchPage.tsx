import { useEffect, useState } from "react";
import { Filter, Search } from "lucide-react";
import {
  PROGRESS_LABEL,
  PROGRESS_VIEWS,
  RECOMMENDATIONS,
  RECOMMENDATION_LABEL,
  batchEligible,
  filterByProgress,
  filterCases,
  progressCounts,
} from "@expense-review-agent/shared/browser";
import type {
  BatchCompleteResponse,
  CaseListItem,
  CaseStatus,
  ProgressView,
  Recommendation,
  WorkflowActionResponse,
} from "@expense-review-agent/shared/browser";
import { useCaseList } from "../../api/queries";
import { closeCase, openCase } from "../../app/router";
import { ErrorState } from "../../components/States";
import { CaseDetail } from "../case/CaseDetail";
import { BatchCompleteDialog } from "./BatchCompleteDialog";
import { CaseTable } from "./CaseTable";

const NOTICE_MS = 2500;

/** 處理後的狀態仍屬於目前分頁嗎？不屬於時要關閉詳情（案件已移出目前列表）。 */
const staysInView = (status: CaseStatus, view: ProgressView) => view === "ALL" || view === status;

/**
 * 案件初審工作台：依處理進度分流的列表，右側並排案件詳情。
 * 互動規則見 docs/design/interaction-patterns.md「本輪工作台操作提案」。
 */
export function WorkbenchPage({ selectedCaseNumber }: { selectedCaseNumber: string | null }) {
  const list = useCaseList();
  const items = list.data ?? [];

  const [progress, setProgress] = useState<ProgressView>("PENDING");
  const [caseNumberQuery, setCaseNumberQuery] = useState("");
  const [applicantQuery, setApplicantQuery] = useState("");
  const [filters, setFilters] = useState<Recommendation[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const filtered = filterCases(
    filterByProgress(items, progress),
    caseNumberQuery,
    applicantQuery,
    filters,
  );
  const eligible = batchEligible(filtered);
  const picked = eligible.filter((c) => checked.includes(c.caseNumber));
  const batchMode =
    (progress === "PENDING" || progress === "ALL") &&
    filters.length === 1 &&
    filters[0] === "APPROVE";
  const counts = progressCounts(items);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  function close() {
    setExpanded(false);
    const previous = selectedCaseNumber;
    closeCase();
    requestAnimationFrame(() => document.getElementById(`open-${previous}`)?.focus());
  }

  /** 條件改變後，若目前案件不在結果中就關閉詳情。 */
  function closeIfHidden(next: CaseListItem[]) {
    if (selectedCaseNumber && !next.some((c) => c.caseNumber === selectedCaseNumber)) close();
  }

  function changeProgress(view: ProgressView) {
    setProgress(view);
    setChecked([]);
    closeIfHidden(filterByProgress(items, view));
  }

  function changeQuery(value: string, kind: "caseNumber" | "applicant") {
    setChecked([]);
    const nextId = kind === "caseNumber" ? value : caseNumberQuery;
    const nextName = kind === "applicant" ? value : applicantQuery;
    if (kind === "caseNumber") setCaseNumberQuery(value);
    else setApplicantQuery(value);
    closeIfHidden(filterCases(filterByProgress(items, progress), nextId, nextName, filters));
  }

  function changeFilters(next: Recommendation[]) {
    setChecked([]);
    setFilters(next);
    closeIfHidden(
      filterCases(filterByProgress(items, progress), caseNumberQuery, applicantQuery, next),
    );
  }

  function clearConditions() {
    setCaseNumberQuery("");
    setApplicantQuery("");
    setFilters([]);
  }

  /** 上一筆／下一筆只在目前篩選結果內循環。 */
  function adjacent(delta: number) {
    if (!filtered.length) return;
    const index = filtered.findIndex((c) => c.caseNumber === selectedCaseNumber);
    const next = filtered[(index + delta + filtered.length) % filtered.length];
    if (next) openCase(next.caseNumber);
  }

  function handledOne(response: WorkflowActionResponse) {
    setChecked([]);
    setNotice(
      `${response.caseNumber}：${response.status === "AWAITING_INFO" ? "已退回補件" : "已完成初審"}`,
    );
    if (!staysInView(response.status, progress)) close();
  }

  function handledBatch(response: BatchCompleteResponse) {
    setBatchOpen(false);
    setChecked([]);
    setNotice(`已完成 ${response.results.length} 筆初審`);
    const selected = response.results.find((r) => r.caseNumber === selectedCaseNumber);
    if (selected && !staysInView(selected.status, progress)) close();
  }

  const conditionsActive = Boolean(caseNumberQuery || applicantQuery || filters.length);

  return (
    <main
      className={`workbench ${selectedCaseNumber ? "with-detail" : ""} ${selectedCaseNumber && expanded ? "detail-expanded" : ""}`}
    >
      <section className="list-panel" aria-label="案件列表">
        <div className="list-header">
          <div>
            <h1>案件初審</h1>
            {list.isSuccess && <span className="muted">{counts.PENDING} 筆待處理</span>}
          </div>
        </div>

        <div className="tabs" aria-label="依處理進度檢視">
          {PROGRESS_VIEWS.map((view) => (
            <button
              type="button"
              key={view}
              className={progress === view ? "selected" : ""}
              aria-pressed={progress === view}
              onClick={() => changeProgress(view)}
            >
              {PROGRESS_LABEL[view]}
              {list.isSuccess && <span>{counts[view]}</span>}
            </button>
          ))}
        </div>

        {notice && (
          <div className="completion-notice" role="status">
            <span>{notice}</span>
          </div>
        )}

        <div className="searchbar">
          <label>
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="搜尋案件編號"
              placeholder="搜尋案件編號"
              value={caseNumberQuery}
              onChange={(e) => changeQuery(e.target.value, "caseNumber")}
            />
          </label>
          <label>
            <Search size={17} aria-hidden="true" />
            <input
              aria-label="搜尋申請人"
              placeholder="搜尋申請人"
              value={applicantQuery}
              onChange={(e) => changeQuery(e.target.value, "applicant")}
            />
          </label>
          <details className="filter-menu">
            <summary title="複選初審建議">
              <Filter size={17} aria-hidden="true" />
              初審建議
              {filters.length > 0 && <span>{filters.length}</span>}
            </summary>
            <div>
              <strong>初審建議</strong>
              {RECOMMENDATIONS.map((r) => (
                <label key={r}>
                  <input
                    type="checkbox"
                    checked={filters.includes(r)}
                    onChange={() =>
                      changeFilters(
                        filters.includes(r) ? filters.filter((v) => v !== r) : [...filters, r],
                      )
                    }
                  />
                  {RECOMMENDATION_LABEL[r]}
                </label>
              ))}
              <button type="button" onClick={() => changeFilters([])}>
                清除篩選
              </button>
            </div>
          </details>
        </div>

        <div className="table-scroll">
          {list.isPending ? (
            <div className="empty" aria-busy="true">
              <p>正在載入案件…</p>
            </div>
          ) : list.isError ? (
            // 不顯示空列表，避免被誤解為「沒有案件」
            <ErrorState
              title="案件列表載入失敗"
              error={list.error}
              onRetry={() => void list.refetch()}
            />
          ) : (
            <>
              <CaseTable
                items={filtered}
                selectedCaseNumber={selectedCaseNumber}
                showStatus={progress === "ALL"}
                batchMode={batchMode}
                eligible={eligible}
                checked={checked}
                onToggleAll={(all) => setChecked(all ? eligible.map((c) => c.caseNumber) : [])}
                onToggle={(caseNumber, on) =>
                  setChecked((current) =>
                    on ? [...current, caseNumber] : current.filter((n) => n !== caseNumber),
                  )
                }
                onSelect={openCase}
              />
              {filtered.length === 0 && (
                <div className="empty">
                  <Search size={26} aria-hidden="true" />
                  <h2>
                    {conditionsActive
                      ? "找不到符合的案件"
                      : progress === "ALL"
                        ? "目前沒有案件"
                        : `目前沒有${PROGRESS_LABEL[progress]}案件`}
                  </h2>
                  <p>可切換處理進度或調整搜尋條件。</p>
                  {conditionsActive && (
                    <button type="button" onClick={clearConditions}>
                      清除所有條件
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="list-footer">
          <span>共 {filtered.length} 筆案件</span>
          {batchMode && (
            <div className="batch-actions">
              <span>已選 {picked.length} 筆</span>
              <button
                type="button"
                className="primary"
                disabled={picked.length === 0}
                onClick={() => setBatchOpen(true)}
              >
                完成所選初審
              </button>
            </div>
          )}
        </div>
      </section>

      {selectedCaseNumber && (
        <CaseDetail
          key={selectedCaseNumber}
          caseNumber={selectedCaseNumber}
          expanded={expanded}
          onToggleExpand={() => setExpanded((value) => !value)}
          onClose={close}
          onPrevious={() => adjacent(-1)}
          onNext={() => adjacent(1)}
          onHandled={handledOne}
        />
      )}

      <div className="sr-only" aria-live="polite">
        {notice}
      </div>

      {batchOpen && (
        <BatchCompleteDialog
          picked={picked}
          onClose={() => setBatchOpen(false)}
          onDone={handledBatch}
        />
      )}
    </main>
  );
}
