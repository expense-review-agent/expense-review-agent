## Why

本 change 服務 **M1**，同時觸及兩個 user story：

- **M1-U1**（財務初審人員依 Agent 結果完成初審）：案件列表的模糊搜尋已經比對部門，但部門
  在列表上看不到。使用者能搜一個畫面上不存在的欄位，搜尋結果因此無法解釋——輸入「業務」
  縮減了列表，但沒有任何一欄能說明為什麼這幾筆留下來。
- **M1-U2**（財務主管可追溯 Agent 與人工判斷）：Reviewer 看得到 Agent 對個案的檢查結果，
  但看不到 Agent **憑什麼**檢查。「費用規範」目前是完全不可點的選單項，判斷依據只能靠讀
  程式或問人。要追溯一個判斷，得先能看到判斷所依據的規則集合。

第二點還蓋掉一個現存的治理缺口。產品層 guardrail 要求 R7 重複、R8 拆單只能表述為「疑似」，
且組織設定不可覆寫。目前 `GET /api/policies` 不回傳 `isSuspicionOnly`，所以任何顯示規範的
畫面都只能從 `clauseText` 的字面推斷語氣——而 `clauseText` 是**組織擁有、後台可編輯**的原文。
seed 的 R7 條文剛好寫了「視為疑似重複」，讓問題看起來不存在；客戶把它改成「重複申報」，
guardrail 就會無聲失效。在建規範畫面之前補上這個欄位，是讓 guardrail 由產品端強制，
而不是依賴客戶怎麼寫條文。

## What Changes

**案件列表部門欄**

- 案件列表在「申請人 / 說明」之後新增獨立的**部門**欄位。資料已存在於列表項目
  （`caseListItem.department`），本項不需要後端或 schema 改動。
- 未記錄部門的案件顯示無值符號，語意是「未記錄」而非空部門。

**費用規範唯讀頁面**

- 側選單的「費用規範」保留「即將推出」徽章（完整的規範管理／後台編輯確實還沒做），
  但改為可點擊，開啟**唯讀**的檢查依據頁面。頁面本身明示為唯讀預覽。
- 移除該選單項的 `aria-disabled="true"`：可點擊且會導覽的元素不得標記為 disabled，
  那會讓螢幕閱讀器報出與實際行為相反的狀態。
- 頁面分兩段，對應產品已定案的兩層規則模型：
  - **組織規範條文**：來自 `PolicyRule`，顯示條文參照與條文原文（客戶擁有，存原文不 i18n）。
  - **產品內建安全邊界**：來自 `isGuardrail` 的 `RuleDefinition`，走 i18n、沒有條文可引用。
- 只呈現**當前生效**的檢查。有 `RuleDefinition` 但組織未設條文的規則（例如 R5）不列出，
  避免讓人誤以為那些正在生效。

**規範列表 API**

- `GET /api/policies` 的每個項目新增 `isSuspicionOnly` 與 `isGuardrail`，兩者都取自
  `RuleDefinition`（產品擁有），不取自組織可編輯的欄位。
- 回應納入沒有對應 `PolicyRule` 的內建 guardrail。這類檢查**確實會被評估**
  （`GUARD_ELIGIBILITY` 在案件檢查中以 `policyRuleId: null` 出現），但因為不是條文，
  現行實作永遠不會回傳它們。一個宣稱列出「檢查依據」的回應漏掉它們就是在誤導。
- **BREAKING**（僅內部契約）：`policyItemSchema.name` 改名為 `nameKey`。該欄位存的一直是
  i18n key（`"rule.R1.name"`）而不是顯示名稱，欄名與內容不符會誘導呼叫端直接顯示 key。
  目前沒有任何前端消費者，此刻改名的成本為零。
- 條文層項目的 `clauseRef` / `clauseText` 語意不變。guardrail 項目沒有條文，
  這兩欄為無值——不以 i18n 文案偽造成條文。

不在本次範圍：規範的編輯或後台、依費用類別的篩選 UI（API 既有參數保留不動）、
把未啟用的規則型錄搬上畫面。

## Capabilities

### New Capabilities

（無。費用規範頁面屬既有的 `reviewer-workbench` 工作台能力。）

### Modified Capabilities

- `reviewer-workbench`：`案件列表` 的欄位組成新增部門欄；新增「費用規範唯讀頁面」requirement，
  規定兩段式呈現、疑似語氣標註、唯讀邊界與選單項的可點擊／無障礙行為。
- `review-api`：`規範列表` 新增 `isSuspicionOnly` / `isGuardrail` 欄位，納入無條文的內建
  guardrail，並明訂這兩個欄位取自產品擁有的規則型錄而非組織可編輯的條文。

## Impact

**稽核與可追溯性**：不新增任何稽核欄位，不寫入任何新紀錄。兩項都是既有資料的唯讀呈現：
規範頁面不建立 run、不觸發判定、不產生 `AuditEvent`。`Disposition` 與 `AuditEvent`
的 append-only 性質不受影響。規範頁面顯示的是**當前 ACTIVE 版本**的條文，因此它回答的是
「現在的依據」，不是「某個舊案件當時的依據」——後者屬個案的 `policyVersionId` 回放，
不在本頁職責內，頁面須避免讓人誤讀為歷史依據。

**程式碼**

- `packages/shared/src/api.ts`：`policyItemSchema` 加兩欄、`name` 改名 `nameKey`（純新增與改名，
  不動其他 schema）。
- `packages/shared/src/i18n/zh-TW.ts`：規範頁面文案、疑似語氣註記、兩段標題、唯讀說明。
  guardrail 的名稱／說明沿用既有 `rule.*` key。
- `apps/api/src/policies/policies.service.ts`：回傳新欄位，並補上內建 guardrail 的查詢。
- `apps/api/src/policies/policies.service.spec.ts`：目前沒有測試，本次補上。
- `apps/web`：`CaseTable` 加欄、`app.css` 調整 table grid 欄數、新增規範頁面與路由、
  `AppShell` 選單項改為可點擊連結、`api/queries.ts` 新增查詢。

**資料庫**：無 migration。`isSuspicionOnly`、`isGuardrail`、`department` 都已存在於 schema。

**相依套件**：無新增。
