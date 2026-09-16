// =============================================================================
// 規則檢查 → 工作台顯示模型
//
// 顯示層 guardrail（CLAUDE.md 規則 2、3、4）：
// - 只有 PASS 會顯示為通過（✅）。GATED / ABSTAIN / PENDING_HUMAN 一律是「需人工確認」，
//   絕不顯示為通過。
// - isSuspicionOnly 的規則（R7 重複、R8 拆單）未通過時一律以「疑似」表述；即使文案表
//   的句子漏了「疑似」，也改用疑似通用句保底。這是產品層 guardrail，不可被文案覆寫。
// - 非通過卻沒有證據 → 標記 evidenceMissing，讓 UI 明示而不是靜默隱藏。
// - 不輸出信心度、五態原始值、§ 條號：UI 只拿得到下面這個 view 的欄位。
// =============================================================================

import { t, lookupMessage } from "../i18n/format.ts";
import type { RuleOutcome } from "../enums.ts";
import type { CaseCheck } from "../api.ts";

export type CheckTone = "ok" | "fail" | "attention";

export interface CheckEvidenceView {
  snippet: string | null;
  relatedCaseId: string | null;
  relatedCaseNumber: string | null;
}

export interface CheckView {
  key: string;
  tone: CheckTone;
  /** 列標題（規則名稱；疑似類未通過時加「疑似」前綴）。 */
  title: string;
  /** 狀態標籤：通過／未通過／需人工確認／疑似。 */
  statusLabel: string;
  /** 白話理由。 */
  detail: string;
  /** 規範條文原文（組織自訂，不轉譯）。 */
  policyText: string | null;
  isSuspicion: boolean;
  /** 非通過結果卻沒有任何證據——治理上不該發生，UI 必須明示。 */
  evidenceMissing: boolean;
  evidence: CheckEvidenceView[];
}

const SUSPICION_WORD = "疑似";

/** RuleOutcome → 顯示語氣。窮舉 switch：新增 outcome 時這裡會編譯失敗。 */
export function outcomeTone(outcome: RuleOutcome): CheckTone {
  switch (outcome) {
    case "PASS":
      return "ok";
    case "FAIL":
      return "fail";
    case "GATED":
    case "ABSTAIN":
    case "PENDING_HUMAN":
      return "attention";
    default: {
      const unreachable: never = outcome;
      return unreachable;
    }
  }
}

/** 規則名稱；文案表沒有時顯示「規則 <code>」。 */
export function ruleName(ruleCode: string): string {
  const code = ruleCode.startsWith("GUARD_") ? "guard.eligibility" : ruleCode;
  return lookupMessage(`rule.${code}.name`) ?? `規則 ${ruleCode}`;
}

export function toCheckView(check: CaseCheck): CheckView {
  const tone = outcomeTone(check.outcome);
  const isSuspicion = check.isSuspicionOnly && tone !== "ok";
  const name = ruleName(check.ruleCode);

  let detail = t(check.messageKey, check.messageParams, `outcome.${check.outcome}`);
  if (isSuspicion && !detail.includes(SUSPICION_WORD)) {
    detail = t("outcome.FAIL.suspicion");
  }

  const statusKey = isSuspicion ? "suspicion" : tone;

  return {
    key: check.checkKey,
    tone,
    title: isSuspicion ? `${SUSPICION_WORD}${name}` : name,
    statusLabel: t(`checkStatus.${statusKey}`),
    detail,
    policyText: check.policyText,
    isSuspicion,
    evidenceMissing: check.outcome !== "PASS" && check.evidence.length === 0,
    evidence: check.evidence.map((e) => ({
      snippet: e.snippet,
      relatedCaseId: e.relatedCaseId,
      relatedCaseNumber: e.relatedCaseNumber,
    })),
  };
}

export interface HumanAnalysisView {
  /** 已完成且通過的檢查。 */
  completed: CheckView[];
  /** Agent 無法確定、需人工確認的項目（所有非通過結果）。 */
  uncertain: CheckView[];
}

/**
 * HUMAN 案件的三段式分組（已完成／無法確定／建議）。只依 tone 分組呈現，
 * 不產生任何新判定；「建議」段落用 `suggestion.HUMAN` 文案。
 */
export function groupHumanAnalysis(views: readonly CheckView[]): HumanAnalysisView {
  return {
    completed: views.filter((v) => v.tone === "ok"),
    uncertain: views.filter((v) => v.tone !== "ok"),
  };
}

/** 案件層級的關聯案件（跨所有檢查的證據，依案件 id 去重）。 */
export function relatedCasesFromChecks(
  views: readonly CheckView[],
): Array<{ id: string; caseNumber: string }> {
  const seen = new Map<string, string>();
  for (const v of views) {
    for (const e of v.evidence) {
      if (e.relatedCaseId && !seen.has(e.relatedCaseId)) {
        seen.set(e.relatedCaseId, e.relatedCaseNumber ?? e.relatedCaseId);
      }
    }
  }
  return [...seen].map(([id, caseNumber]) => ({ id, caseNumber }));
}
