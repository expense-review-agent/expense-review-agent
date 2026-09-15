// =============================================================================
// zh-TW 文案表（前後端共用）
//
// 系統訊息、狀態、規則判定理由、動作名稱都以 messageKey 查表組字；DB 不存中文。
// 組織自訂的 Policy 條文原文與人工填寫的理由「不」進這張表，原樣顯示。
//
// 插值語法：`{name}` 會被 messageParams.name 取代。
// 疑似類規則（RuleDefinition.isSuspicionOnly，如 R7 / R8）的 FAIL 文案必須含「疑似」，
// presentation/check-view.ts 會再做一次保底檢查。
// =============================================================================

export const zhTW: Readonly<Record<string, string>> = {
  // ---- 四分類 ----
  "classification.NORMAL": "NORMAL",
  "classification.MISSING": "MISSING",
  "classification.EXCEPTION": "EXCEPTION",
  "classification.HUMAN": "HUMAN",
  "classification.NORMAL.hint": "建議通過",
  "classification.MISSING.hint": "建議補件",
  "classification.EXCEPTION.hint": "建議人工審核",
  "classification.HUMAN.hint": "轉交人工",

  // ---- 三桶建議 ----
  "recommendedAction.APPROVE": "建議通過",
  "recommendedAction.REQUEST_INFO": "建議補件",
  "recommendedAction.MANUAL_REVIEW": "建議人工審核",

  // ---- 人工最終結論（人工判斷 modal 的選項）----
  "finalAction.APPROVE": "通過",
  "finalAction.REQUEST_INFO": "補件",
  "finalAction.MANUAL_REVIEW": "人工審核（轉呈主管）",

  // ---- 案件流程狀態 ----
  "caseStatus.DRAFT": "草稿",
  "caseStatus.QUEUED": "待審",
  "caseStatus.AWAITING_INFO": "待補件",
  "caseStatus.DISPOSED": "已處置",
  "caseStatus.REVIEW_CLOSED": "已結案",

  // ---- 一致性徽章（顯示後端固化值，前端不重算）----
  "consistencyFlag.CONSISTENT": "與 Agent 一致",
  "consistencyFlag.OVERRIDDEN": "已覆寫 Agent 建議",
  "consistencyFlag.HUMAN_ASSUMED": "人工承擔判斷",
  "consistencyFlag.ESCALATED": "已轉呈主管",
  "consistencyFlag.REASON_MISSING": "缺少理由",
  "consistencyFlag.PENDING_DECISION": "尚未決定",

  // ---- Reviewer 處置動作（ACCEPT 依建議而有不同語意）----
  "action.ACCEPT.APPROVE": "確認通過",
  "action.ACCEPT.APPROVE.hint": "採用 Agent 建議，本案初審通過。",
  "action.ACCEPT.REQUEST_INFO": "確認退回補件",
  "action.ACCEPT.REQUEST_INFO.hint": "採用 Agent 建議，請申請人補件。",
  "action.ACCEPT.MANUAL_REVIEW": "轉呈主管",
  "action.ACCEPT.MANUAL_REVIEW.hint": "Agent 未下結論；轉呈後由主管判斷，Reviewer 不下最終結論。",
  "action.REQUEST_INFO": "退回補件",
  "action.REQUEST_INFO.hint": "不採用 Agent 建議，改為請申請人補件，須填寫理由。",
  "action.MANUAL_JUDGEMENT": "人工判斷",
  "action.MANUAL_JUDGEMENT.hint": "由你指定最終結論並填寫理由，結論由你承擔。",
  "action.HOLD": "暫緩處理",
  "action.HOLD.hint": "暫不下結論，案件留在待審。",

  // ---- 規則名稱 ----
  "rule.R1.name": "住宿費額度",
  "rule.R2.name": "餐費額度",
  "rule.R3.name": "大額核准文件",
  "rule.R4.name": "應附憑證",
  "rule.R5.name": "申報與單據金額一致",
  "rule.R6.name": "申請期限",
  "rule.R7.name": "重複申報",
  "rule.R8.name": "拆單",
  "rule.R9.name": "買方統編",
  "rule.R10.name": "多憑證加總",
  "rule.guard.eligibility.name": "Agent 可判斷範圍",

  // ---- 規則判定理由 ----
  "rule.R1.PASS": "住宿費未超過每晚上限。",
  "rule.R1.FAIL": "住宿費超過每晚上限。",
  "rule.R4.PASS": "應附憑證齊全。",
  "rule.R4.FAIL": "金額達門檻，但未附規定的正式發票。",
  "rule.R5.PASS": "申報金額與單據金額一致。",
  "rule.R5.FAIL": "申報金額與單據金額不一致。",
  "rule.R7.PASS": "未發現疑似重複申報。",
  "rule.R7.FAIL": "與另一筆案件的單號、金額、日期相同，疑似重複申報，需人工確認。",
  "rule.R8.PASS": "未發現疑似拆單。",
  "rule.R8.FAIL": "同申請人、同店家於短期內多筆申報，加總超過門檻，疑似拆單，需人工確認。",
  "rule.guard.eligibility.ABSTAIN":
    "本案超出 Agent 目前可判斷的範圍（例如非 TWD 幣別），已主動轉交人工。",

  // ---- 依結果類型的通用句（訊息鍵缺漏時保底）----
  "outcome.PASS": "此項檢查通過。",
  "outcome.FAIL": "此項檢查未通過。",
  "outcome.GATED": "申報與單據資料不一致，Agent 無法確定結論，需人工確認。",
  "outcome.ABSTAIN": "Agent 無法判斷此項，已轉交人工。",
  "outcome.PENDING_HUMAN": "此項需人工確認。",
  "outcome.FAIL.suspicion": "疑似異常，需人工確認。",

  // ---- 檢查列狀態標籤 ----
  "checkStatus.ok": "通過",
  "checkStatus.fail": "未通過",
  "checkStatus.attention": "需人工確認",
  "checkStatus.suspicion": "疑似",

  // ---- Agent 建議理由 ----
  "suggestion.NORMAL": "資料完整，已執行的檢查均通過，未發現異常。",
  "suggestion.MISSING": "有規定的文件或資訊缺漏，建議請申請人補件後再審。",
  "suggestion.EXCEPTION": "有檢查未通過或出現疑似異常，建議人工審核。",
  "suggestion.HUMAN": "此案涉及 Agent 無法確定的判斷，建議由 Reviewer 綜合業務情境後決定。",
  "suggestion.fallback": "請參考下方檢查結果。",

  // ---- 通用訊息 ----
  "message.generic": "（無說明）",
};
