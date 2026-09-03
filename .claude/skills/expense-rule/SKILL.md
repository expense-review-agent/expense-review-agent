---
name: expense-rule
description: 在費用初審引擎中新增或修改一條檢查規則（R1–R13 或 guardrail）。當任務提到新增規則、修改額度門檻、調整 Policy 參數、規則沒有被觸發、或規則判定結果不正確時使用。涵蓋 RuleDefinition 型錄、PolicyRule 組織設定、雙假設評估、證據掛載與 i18n 訊息的完整流程。
---

# 新增或修改一條費用檢查規則

規則分兩層。**先確認要動哪一層**，這是最常做錯的一步：

| 需求                                           | 動哪裡                                                   |
| ---------------------------------------------- | -------------------------------------------------------- |
| 引擎要支援一種新的檢查（如「跨部門分攤加總」） | 新增 `RuleDefinition` + handler + 測試                   |
| 客戶把住宿上限從 4000 改成 5000                | 只改 `PolicyRule.params`，**不寫程式**                   |
| 同一種檢查要對不同費用類別分設門檻             | 新增多筆 `PolicyRule`，共用同一個 definition             |
| 產品內建的安全邊界（不判稅務適格性）           | `RuleDefinition` 設 `isGuardrail = true`，無 policy rule |

如果只是第二、三種情況，停在這裡——那是資料，不是程式碼。

## 新增一種檢查類型的完整步驟

### 1. 先開 OpenSpec proposal

新規則會改變 Agent 的判定行為，屬於非瑣碎改動。proposal 至少要寫清楚：
規則語意、觸發條件、是否依賴一致性比對、是否只能標「疑似」、
無法判定時的行為（GATED 還是 ABSTAIN）、以及一個會命中和一個不會命中的例子。

### 2. 定義 params 的 Zod schema

位置：`packages/shared/src/domain/rule-params.ts`

加進 discriminated union，`paramsSchemaKey` 就是這裡的 key。
後台編輯表單會依這份 schema 動態渲染，所以欄位要給得完整
（型別、單位、預設值、是否必填）。

金額用 string 表示後轉 Decimal，**不要用 number**。

### 3. 新增 RuleDefinition 的 seed

位置：`apps/api/prisma/seed/rule-definitions.ts`

必須決定的幾個欄位，決定錯了會導致行為錯誤：

- `layer`：`MATCH`（本身就是比對）或 `RULE`（規則判定）
- `dependsOnConsistency`：**這條規則有沒有用到會被比對的欄位（金額、日期、店家）？**
  用到 → `true`，會觸發雙假設評估。
  獨立規則：R2 期限、R4 附件、R6 可報銷、R7 重複、R8 拆單、R9 統編。
- `isSuspicionOnly`：這條規則會不會指控人？重複申報、拆單 → `true`。
- `isGuardrail`：沒有 Policy 條文可引用的產品內建檢查 → `true`。
- `messageKeyPrefix`：實際 key 為 `{prefix}.{outcome}`，各 outcome 都要有對應文案。

### 4. 實作 handler

位置：`apps/api/src/review/rules/`

handler 是純函式：吃 `(context, params)` 回傳 `RuleResultDraft`。
不要在 handler 裡讀 DB、寫 DB、或呼叫外部服務——所有需要的資料由 context 帶進來。
這樣才能單純用資料驅動測試，也才能在雙假設評估時被呼叫兩次。

**必須處理的四件事：**

1. **回傳正確的 outcome。** 不確定時不要回 `PASS`。
   規則條件不成立 → `ABSTAIN` + `RULE_NOT_APPLICABLE`；
   超出能力 → `ABSTAIN` + `BEYOND_CAPABILITY`。
2. **掛上 Evidence。** 至少要有一筆指回 `ExtractedField` 或 `Receipt`，
   以及一筆指回 `PolicyRule`（guardrail 除外）。DB CHECK 會擋沒有父節點的 Evidence。
   跨案件的規則（R7/R8）要填 `Evidence.relatedCaseId`，UI 才能跳轉。
3. **填 `evaluationDetail`。** 放判定用到的中間值，如
   `{ limit: 4000, actual: 6800, excess: 2800 }`。稽核回放靠這個。
4. **messageKey 與 params 分離。** 訊息裡不要組中文字串。

### 5. 雙假設評估

`dependsOnConsistency = true` 的規則由 engine 自動處理，handler 不需要知道：

- 比對一致 → 跑一次，`evaluationBasis = SINGLE`
- 比對不一致 → 用申報值和單據值各跑一次
  - 兩邊 outcome 相同 → 採用該結果，`evaluationBasis = BOTH_AGREE`
  - 兩邊不同 → `outcome = GATED`，`evaluationBasis = DIVERGENT`，
    必填 `gateReasonKey` 與 `gatedByMatchId`

**不要在 handler 裡自己判斷比對是否一致然後 early return。**
那會繞過雙假設評估，造成漏判——例如兩個金額都超額，卻因為比對失敗而不報。

### 6. i18n 文案

位置：`packages/shared/src/i18n/zh-TW.ts`

每個可能的 outcome 都要有 key。文案用 `{placeholder}` 帶入 params。
`isSuspicionOnly` 的規則，文案必須是推測語氣（「疑似」「可能」），不得斷言。

### 7. 測試（必要）

位置：`apps/api/src/review/rules/__tests__/`

每條規則至少四個 case：命中、不命中、參數邊界值、資料不足時 abstain。
`dependsOnConsistency = true` 的規則再加兩個：兩基準一致、兩基準分歧。

### 8. Demo 案件

如果這條規則需要在 demo 中展示，到 `apps/api/prisma/seed/cases.ts` 加一筆
或調整既有案件。跨案件規則（R7/R8）需要**成對**的案件才能觸發，
不能只加一筆。

## 檢查清單

- [ ] OpenSpec proposal 已建立
- [ ] params Zod schema 已加入 union
- [ ] RuleDefinition seed 的四個布林欄位都想清楚了
- [ ] handler 是純函式，沒有 DB 存取
- [ ] Evidence 有掛，跨案件規則有填 relatedCaseId
- [ ] evaluationDetail 有值
- [ ] 所有 outcome 都有 i18n key，疑似類規則用推測語氣
- [ ] 測試涵蓋命中／不命中／邊界／資料不足
- [ ] `pnpm lint && pnpm typecheck && pnpm test` 通過
