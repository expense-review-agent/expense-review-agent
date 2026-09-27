## Context

見 `proposal.md` — Why。設計上只需要以下現狀：

- 列表項目已帶 `department`（上一個 change 加入），`matchesSearch` 已比對部門。
  部門欄純粹是顯示端的補齊，**沒有後端或 schema 工作**。
- `GET /api/policies` 與 `PoliciesService.list()` 已存在，但目前：
  1. 只查 `PolicyRule where isActive: true`，**沒有限定 `policyVersion.status = ACTIVE`**；
  2. 不回傳 `isSuspicionOnly` / `isGuardrail`；
  3. 回傳的 `name` 欄位存的是 i18n key（`"rule.R1.name"`）而不是名稱；
  4. `violationHandling` 恆為 `null`（schema 無對應來源）。
- 兩層規則模型已在 schema 定案：`RuleDefinition`（產品擁有、走 i18n）與 `PolicyRule`
  （組織擁有、存條文原文）。guardrail 型的 definition 沒有 `PolicyRule`
  （seed 的 `GUARD_ELIGIBILITY` 在案件檢查中以 `policyRuleId: null` 出現）。
- `packages/shared/src/presentation/` 已是純函式呈現邏輯的落點（`queue-view`、
  `case-history`、`check-view`），因為 `apps/web` 刻意沒有測試框架。
- 表格是 `display: grid` 搭配固定 `grid-template-columns`，外層 `.table__scroll`
  已有 `overflow-x: auto`，`min-width: 860px`。
- M1 沒有認證，也沒有任何 request 層的組織上下文——`CasesService.list()` 同樣未依組織
  過濾。這個限制會影響下面的 Decision 3。

## Goals / Non-Goals

**Goals**

- 讓「搜尋比對的欄位都看得見」成為結構性事實，而不是靠人記得。
- 讓「只能標疑似」這個產品層 guardrail 由**產品擁有的資料**驅動，組織改條文不能動它。
- 讓規範頁面呈現的集合等於 Agent **實際會評估**的集合，包含沒有條文的內建檢查。

**Non-Goals**

- 不做規範編輯、版本切換、條文上傳或任何後台設定。
- 不在頁面上做費用類別篩選（API 既有的 `category` 參數保留，前端不使用）。
- 不處理 `violationHandling` 恆為 `null` 的問題。它的來源需要 schema 討論，
  與本次的顯示目標無關，留在原狀比順手改掉更安全。
- 不引入組織範圍過濾（見 Decision 3）。
- 不呈現未被組織設定的規則型錄（使用者已就此拍板）。
- 不在規範頁面提供案件詳情抽屜——此頁與個別案件無關。

## Decisions

### Decision 1：一個扁平的 `items` 陣列加旗標，而不是兩個陣列

回應維持 `{ items: [...] }`，每個項目帶 `isGuardrail` 與 `isSuspicionOnly` 兩個布林。
分段由前端依 `isGuardrail` 分組。

**替代方案：回應改成 `{ clauses: [...], guardrails: [...] }`。** 否決——那是對既有契約
的結構性破壞，而規格要求的只是「呼叫端能區分」，一個旗標就足夠。扁平陣列也讓
「規範代碼與案件檢查一致」這條既有 scenario 的檢查方式不變。

**替代方案：另開一個 `/api/guardrails` 端點。** 否決——同一個問題（「Agent 檢查什麼」）
被拆成兩個請求，頁面得自己組合並處理其中一個失敗的狀態，錯誤處理複雜度換不到任何好處。

### Decision 2：`name` 改名為 `nameKey`

欄位存的一直是 i18n key。叫 `name` 會誘導呼叫端直接顯示，而顯示出來就是
`rule.R1.name`。目前**沒有任何前端消費者**（已全 repo 確認），此刻改名的成本為零，
之後就不是了。

guardrail 項目的名稱同樣走 `nameKey`，沿用既有的 `rule.guard.eligibility.name`；
說明走 `descKey`（可能為 null）。這符合 i18n 邊界：系統訊息用 key，
組織條文原文存原文。

### Decision 3：修 ACTIVE 版本過濾，但**不**加組織過濾

`PolicyRule` 的查詢補上 `policyVersion: { status: "ACTIVE" }`。規格要求「當前生效」，
而現行查詢只看 `isActive`，一旦出現第二個 `PolicyVersion`（DRAFT 或 ARCHIVED），
它們的規則就會混進「當前依據」。這是我正在修改的同一個查詢裡的正確性缺陷，
不修等於讓頁面在第二個版本出現的當天開始說謊。

**不**加組織過濾，儘管 `PolicyDocument` 有 `organizationId`。M1 沒有認證，
沒有 request 層的組織上下文可用；要加就得先發明一個傳遞機制，而那是跨越
本次範圍的架構決定。`CasesService.list()` 也處於同樣狀態，所以這不是本次引入的
不一致。記在 Risks，等認證進來時與其他列表查詢一起處理。

### Decision 4：內建 guardrail 以第二次查詢取得，並以規則代碼去重

`RuleDefinition where isGuardrail: true` 查一次，映射為條文欄位為 `null` 的項目，
接在條文型項目之後。

去重以**規則代碼**為鍵：若某個 guardrail definition 竟然也有 ACTIVE 的 `PolicyRule`
（依模型不該發生，但 schema 不禁止），以條文型項目為準，不重複列出。這個選擇的理由是
條文型項目帶的資訊更多（參照＋原文），而重複列出同一個檢查會讓使用者以為有兩個檢查。

**替代方案：用一次 `RuleDefinition` 查詢 include `policyRules`，在記憶體裡分流。**
否決——那會撈進沒有條文也非 guardrail 的 definition（例如 R5），必須在應用層再濾掉，
而「不列出未設定的規則」這條規格用 `where` 表達比用 `filter` 表達更難寫錯。

### Decision 5：分組與排序放 `packages/shared/src/presentation/policy-view.ts`

`buildPolicyView(items)` 回 `{ clauses, guardrails, total }`，依 `isGuardrail` 分流，
各段內維持後端的順序（條文型已由後端依 `orderIndex` 排序）。

理由與 `queue-view` 相同：`apps/web` 刻意沒有測試框架，所以任何會分流、分組或計數的
邏輯放在 web 就等於沒有測試。放 shared 才能用 `node --test` 釘住
「疑似旗標為真的項目一定帶得出疑似註記」與「guardrail 段的項目條文欄位一律為 null」
這兩條不變量。

### Decision 6：疑似語氣由 i18n 文案承載，旗標只決定「是否顯示」

新增 `policy.suspicionOnly.badge` 與 `policy.suspicionOnly.note` 兩個 key，
在 `isSuspicionOnly === true` 時渲染。前端**不**檢查 `clauseText` 的字面，
也不對條文原文做任何字串處理。

這樣 guardrail 的成立條件是「後端旗標為真」這一件可測的事，而不是「條文剛好寫了某個詞」。
Decision 4 的第二次查詢與這條合起來，讓組織改寫條文完全無法影響語氣標註。

### Decision 7：側選單項目改為 `<a>`，保留「即將推出」標示，移除 `aria-disabled`

目前是 `<span className="side__item side__item--off" aria-disabled="true">`。改成與
「案件總覽」「已結案案件」相同的 `<a href>`，並保留 `.side__soon` 徽章。

`aria-disabled="true"` 必須移除：它會讓輔助技術報出「已停用」，而該元素實際上會導覽。
徽章則保留——它指的是**完整的規範管理功能**尚未提供，這個陳述在唯讀頁面上線後依然成立。
為了讓這件事不靠徽章的位置去暗示，無障礙名稱會明確帶出「唯讀預覽」，
頁面本身也有一行唯讀說明。

`.side__item--off` 這個 class 不再套用於此項（它帶的是不可點擊的灰階樣式），
改用一個保留徽章但維持可點擊外觀的樣式。

### Decision 8：表格第 9 欄的寬度處理

`grid-template-columns` 在申請人之後插入 `76px` 的部門欄，`min-width` 由 `860px`
提到 `936px`。`.table__scroll` 已有 `overflow-x: auto`，窄螢幕維持既有的橫向滾動行為，
不新增斷點、不隱藏欄位。

**替代方案：窄螢幕隱藏部門欄。** 否決——本次改動的理由正是「搜尋比對的欄位必須看得見」，
在某些寬度下藏起來會讓那條規格在該寬度下不成立。

### Decision 9：頁面明示「當前生效版本」，不顯示版本號

頁面標題區放一行說明，指出所列為當前生效的檢查依據、非個別案件當時的判斷依據。

**不**顯示 `PolicyVersion.version` 字串。理由：顯示版本號會招來「那我能不能看舊版」
的期待，而版本切換不在範圍內；更重要的是個案的判斷依據要依該案的 `policyVersionId`
回放，那是案件詳情的職責。這裡只回答「現在」，並把這個邊界寫在畫面上。

## Risks / Trade-offs

**規範查詢未依組織過濾** → 多租戶上線前必須處理。M1 單一組織的 demo 不會表現出問題，
但這是潛在的跨組織資料外洩。已記在 Decision 3；認證進來時與 `CasesService.list()`
等其他未過濾查詢一起處理，不在本次單獨發明機制。

**「不列出未設定的規則」讓使用者看不到完整型錄** → 頁面只回答「現在檢查什麼」。
反面（列出未啟用規則）的風險更高：使用者會以為那些檢查正在生效，而那會讓人低估
需要人工覆核的範圍。取捨方向確定，已由使用者拍板。

**`name` → `nameKey` 是契約改名** → 目前零消費者，已全 repo 確認（僅 `dist/` 的建置產物
與 service 自身引用）。若之後有外部消費者，此改名就不再免費。現在做的成本最低。

**第 9 欄讓表格在窄螢幕更依賴橫向滾動** → 既有行為就是橫向滾動，本次只是把
`min-width` 提高 76px。不隱藏欄位是刻意的（Decision 8）。

**頁面顯示的是當前版本，可能與某個舊案件當時的依據不同** → 以畫面文案明示邊界
（Decision 9）。真正的個案回放屬案件詳情的 `policyVersionId`，不在本頁。

## Migration Plan

無資料庫 migration，無相依套件變更，無資料回填。

`nameKey` 改名是同一個 commit 內的前後端同步改動：`packages/shared` 與
`apps/api/src/policies/policies.service.ts` 一起改，沒有跨版本的相容期需求
（前端目前不消費此端點）。

回退方式為還原 commit。因為沒有寫入路徑、沒有 migration、也沒有新增稽核欄位，
回退不會留下任何資料殘跡。
