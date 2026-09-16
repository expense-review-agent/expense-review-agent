// =============================================================================
// 費用規範頁面的顯示模型。
//
// 產品邊界（specs/reviewer-workbench「費用規範唯讀頁面」）：這裡只把後端回傳的
// 檢查依據分成兩段，**不計算風險、不排名、不產生任何結論性表述**。
//
// 分兩段是因為產品的規則模型本來就有兩層，兩層的所有權不同：
//   - clauses   組織條文（PolicyRule）——客戶擁有，clauseText 存原文、不 i18n
//   - guardrails 產品內建安全邊界（isGuardrail 的 RuleDefinition）——沒有條文可引用
// 混在一起呈現會讓使用者以為內建檢查也是某條公司規範，那是錯的。
//
// 為什麼放在 shared 而不是 apps/web：web 刻意沒有測試框架，任何會分流、分組或計數的
// 邏輯放在那裡就等於沒有測試（與 queue-view、case-history 同一個理由）。
// =============================================================================

import type { PolicyItem } from "../api.ts";

export interface PolicyView {
  /** 組織設定的規範條文，帶條文參照與原文。 */
  clauses: PolicyItem[];
  /** 產品內建的安全邊界檢查，沒有條文。 */
  guardrails: PolicyItem[];
  /** 兩段合計，等於後端回傳的項目數。 */
  total: number;
}

/**
 * 依 isGuardrail 分流。兩段內都維持輸入順序——條文型的順序由後端依 orderIndex
 * 決定（那是組織排的條文順序），呈現層不得自行重排。
 */
export function buildPolicyView(items: readonly PolicyItem[]): PolicyView {
  const clauses: PolicyItem[] = [];
  const guardrails: PolicyItem[] = [];

  for (const item of items) {
    if (item.isGuardrail) {
      guardrails.push(item);
    } else {
      clauses.push(item);
    }
  }

  return { clauses, guardrails, total: clauses.length + guardrails.length };
}
