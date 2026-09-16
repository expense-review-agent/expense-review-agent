import { useState } from "react";
import { dispositionOptions, t } from "@expense-review-agent/shared/browser";
import type {
  CaseDetail,
  DispositionOption,
  DispositionRequest,
  DispositionResponse,
} from "@expense-review-agent/shared/browser";
import { useDisposition } from "../../api/queries";
import { CaseStatusTag, ConsistencyFlagBadge } from "../../components/Badges";
import { errorMessage } from "../../components/States";
import { DispositionDialog } from "./DispositionDialog";

/** ISO datetime → `YYYY-MM-DD HH:mm`（本地時區，供人閱讀）。 */
function formatDecidedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Reviewer 處置區。
 * - 只在案件流程狀態為 QUEUED 且有 Agent 建議時提供動作。
 * - 動作集合只來自 shared 合法動作矩陣（dispositionOptions），不另行定義。
 * - 處置結果的一致性徽章取自後端回應（已固化），UI 不重算。
 */
export function DispositionPanel({ detail }: { detail: CaseDetail }) {
  const mutation = useDisposition(detail.id);
  const [selected, setSelected] = useState<DispositionOption | null>(null);
  const [result, setResult] = useState<DispositionResponse | null>(null);

  const run = detail.run;
  const recommendation = run?.recommendedAction ?? null;

  function submit(body: DispositionRequest) {
    mutation.mutate(body, {
      onSuccess: (response) => {
        setResult(response);
        setSelected(null);
      },
    });
  }

  function cancel() {
    if (mutation.isPending) return;
    mutation.reset();
    setSelected(null);
  }

  return (
    <section className="section dispose" aria-labelledby="sec-dispose">
      <h3 id="sec-dispose" className="section__title">
        審核處置
      </h3>

      {result ? (
        <div className="notice notice--success" role="status">
          <div className="notice__title">處置已送出並記入稽核軌跡</div>
          <div className="notice__row">
            結果狀態：
            <CaseStatusTag value={result.resultingStatus} />
            一致性：
            <ConsistencyFlagBadge value={result.consistencyFlag} />
          </div>
        </div>
      ) : detail.caseStatus !== "QUEUED" ? (
        <div className="notice notice--info">
          <div className="notice__row">
            目前處理狀態：
            <CaseStatusTag value={detail.caseStatus} />
            {/* 處置人取自後端的 append-only 紀錄。查無紀錄時明示，
                不以當前使用者或任何預設值替代。 */}
            <span className="notice__actor">
              {detail.disposition ? (
                <>
                  {t("disposition.actor.label")}：{detail.disposition.actorName}
                  <span className="notice__at">
                    {formatDecidedAt(detail.disposition.decidedAt)}
                  </span>
                </>
              ) : (
                t("disposition.actor.unknown")
              )}
            </span>
          </div>
          <div>此案件不在待審狀態，無需在此處置。</div>
        </div>
      ) : !run || !recommendation ? (
        <div className="notice notice--info">Agent 本次沒有提出建議，暫時無法在此處置。</div>
      ) : (
        <>
          <div className="dispose__buttons">
            {dispositionOptions(recommendation).map((option) => (
              <button
                key={option.action}
                type="button"
                className={`btn btn--${option.variant}`}
                onClick={() => {
                  mutation.reset();
                  setSelected(option);
                }}
                disabled={mutation.isPending}
                title={option.hint}
              >
                {option.label}
              </button>
            ))}
          </div>
          {recommendation === "MANUAL_REVIEW" && (
            <p className="dispose__hint">{t("action.ACCEPT.MANUAL_REVIEW.hint")}</p>
          )}
          {mutation.isError && !selected && (
            <div className="notice notice--error" role="alert">
              <div className="notice__title">處置未送出</div>
              {errorMessage(mutation.error)}
            </div>
          )}

          {selected && (
            <DispositionDialog
              option={selected}
              recommendation={recommendation}
              runId={run.runId}
              caseNumber={detail.caseNumber}
              pending={mutation.isPending}
              error={mutation.isError ? errorMessage(mutation.error) : null}
              onSubmit={submit}
              onCancel={cancel}
            />
          )}
        </>
      )}
    </section>
  );
}
