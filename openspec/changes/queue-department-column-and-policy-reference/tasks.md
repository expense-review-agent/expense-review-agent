## 1. shared 契約（`packages/shared/src/api.ts`）

- [x] 1.1 `policyItemSchema` 的 `name` 改名為 `nameKey`，並新增 `descKey`（nullable）、
      `isSuspicionOnly`、`isGuardrail`（皆 boolean），`clauseRef` 與 `clauseText` 改為
      nullable（guardrail 項目無條文）；以 `pnpm --filter shared typecheck` 確認無錯
- [x] 1.2 全 repo 搜尋 `PolicyItem` 與 `policyItemSchema` 的引用，確認除
      `policies.service.ts` 外沒有其他消費者需要跟著改（`dist/` 建置產物不算）；
      以搜尋結果為證

## 2. shared 呈現純函式（`packages/shared/src/presentation/policy-view.ts`）

- [x] 2.1 新增 `buildPolicyView(items)`，依 `isGuardrail` 分流為 `{ clauses, guardrails, total }`，
      各段內維持輸入順序；在 `browser.ts` 匯出
- [x] 2.2 新增 `packages/shared/src/__tests__/policy-view.test.ts`，釘住：條文型與 guardrail
      正確分流、各段維持輸入順序、`total` 等於兩段長度之和、guardrail 段每個項目的
      `clauseRef` 與 `clauseText` 皆為 null、空輸入回兩個空陣列；以 `pnpm --filter shared test` 通過為證
- [x] 2.3 補一個測試：`isSuspicionOnly` 為真的項目在分流後仍保有該旗標（無論落在哪一段），
      確保疑似標註不會在呈現層被丟掉

## 3. shared i18n（`packages/shared/src/i18n/zh-TW.ts`）

- [x] 3.1 新增 `policy.*` 文案：頁面標題與唯讀說明、「當前生效版本」說明、兩段標題
      （組織規範條文／產品內建安全邊界）、產品內建標示、`policy.suspicionOnly.badge`、
      `policy.suspicionOnly.note`、載入與錯誤狀態、側選單的無障礙名稱（含「唯讀預覽」）
- [x] 3.2 在 `__tests__/i18n.test.ts` 釘住每個新 key 存在且非空；並斷言
      `policy.suspicionOnly.*` 的文案含「疑似」、且 `policy.*` 全部文案不含任何指控性字眼
      （不出現「違規」「舞弊」等確定性結論用詞）；以 `pnpm --filter shared test` 通過為證

## 4. 後端規範列表（`apps/api/src/policies/`）

- [x] 4.1 `PoliciesService.list()` 的 `PolicyRule` 查詢補上
      `policyVersion: { status: "ACTIVE" }`（Decision 3），並改用 `nameKey`／`descKey`、
      帶出 `isSuspicionOnly` 與 `isGuardrail`
- [x] 4.2 新增 `RuleDefinition where isGuardrail: true` 的查詢，映射為
      `clauseRef: null` / `clauseText: null` 的項目接在條文型之後；依規則代碼去重，
      衝突時以條文型為準（Decision 4）
- [x] 4.3 新增 `apps/api/src/policies/policies.service.spec.ts`（目前無測試），以手寫 fake
      Prisma 斷言：ACTIVE 版本過濾確實進入 `where`、非 ACTIVE 版本的規則不出現在回應、
      旗標取自 `RuleDefinition`、無條文的 guardrail 有被納入、guardrail 項目條文欄位為 null、
      代碼重複時只出現一次且保留條文、未設定條文且非 guardrail 的 definition 不出現
- [x] 4.4 補一個測試：`clauseText` 不含「疑似」字樣的疑似型規則，其 `isSuspicionOnly`
      仍為 `true`（證明旗標不依賴條文原文）；以 `pnpm --filter api test` 通過為證

## 5. 前端：案件列表部門欄

- [x] 5.1 `CaseTable.tsx` 在「申請人 / 說明」之後新增部門欄位標題與資料格，
      未記錄時顯示無值符號；欄位不可排序（排序鍵仍只有申請日期與案件編號）
- [x] 5.2 `app.css` 的 `.table__head` / `.table__row` 在對應位置插入部門欄寬度，
      `min-width` 由 `860px` 調整為 `936px`（Decision 8）；不新增斷點、不隱藏欄位
- [x] 5.3 在瀏覽器確認：案件總覽與已結案案件兩個頁面都顯示部門欄、
      seed 中無部門的案件顯示無值符號、以部門字串搜尋後每一列的部門欄都能解釋為何相符

## 6. 前端：費用規範唯讀頁面

- [x] 6.1 `api/queries.ts` 新增 `usePolicyList()`，以 `policyListResponseSchema` 驗證
- [x] 6.2 新增 `features/policies/PoliciesPage.tsx`：以 `buildPolicyView` 分兩段渲染，
      條文段顯示規則代碼／條文參照／原樣條文原文，內建段顯示名稱／說明並標示產品內建且
      不顯示條文欄位；`isSuspicionOnly` 為真時渲染疑似徽章與說明
- [x] 6.3 頁面加上唯讀說明與「當前生效版本」說明，且不放任何編輯／新增／刪除入口
- [x] 6.4 載入中顯示載入狀態、請求失敗顯示錯誤與重試入口（沿用 `components/States.tsx`），
      失敗時不呈現為沒有任何檢查依據
- [x] 6.5 `app/router.ts` 的 `PageName` 新增 `"policies"` 並加入 `#/policies`；
      此頁不支援案件抽屜路徑
- [x] 6.6 `AppShell.tsx` 將「費用規範」由 `<span aria-disabled="true">` 改為 `<a href>`，
      保留「即將推出」徽章，移除 `aria-disabled`，並設定含「唯讀預覽」的無障礙名稱
      （Decision 7）
- [x] 6.7 `app.css` 新增規範頁面樣式，並為可點擊但帶徽章的選單項加上不同於
      `.side__item--off` 的樣式（後者是不可點擊的灰階外觀）

## 6b. seed：內建檢查的說明（實作期補入）

驗證時發現 `RuleDefinition.descKey` 在 seed 裡全為 null，導致規範頁面的內建段
只能顯示「（無補充說明）」——規格要求該段「顯示其名稱與說明」，形同未達成。
條文型項目不受影響（`clauseText` 本身就是說明），問題只在沒有條文的內建檢查，
而那正是最需要說明的一項。已向 schema owner 確認後補入。

- [x] 6b.1 seed 的 `GUARD_ELIGIBILITY` definition 加上
      `descKey: "rule.guard.eligibility.desc"`，並在 create 的 data 帶上
      `descKey: d.descKey ?? null`（原本整個 map 都沒有寫入這個欄位）
- [x] 6b.2 新增 `rule.guard.eligibility.desc` 文案，描述這條檢查做什麼
      （與既有的 `.ABSTAIN` 個案判定訊息分開，後者是寫給單一案件結果用的）
- [x] 6b.3 `db:reset` 重建資料並確認 API 回傳該 descKey；i18n 測試釘住此 key 存在、
      不等於名稱、且提到轉交人工（「資料不足不硬判 NORMAL」的體現）

## 7. 驗證

- [x] 7.1 跑 `pnpm lint && pnpm typecheck && pnpm test && pnpm build`，五關全過
- [x] 7.2 以無頭瀏覽器驗證規範頁面：從側選單可點擊進入、兩段分別呈現、
      R7 帶疑似徽章、內建安全邊界出現且無條文欄位、R5 不出現在頁面上、
      唯讀說明存在且頁面無編輯入口、`#/policies` 重新整理後仍在同頁
- [x] 7.3 以無頭瀏覽器驗證選單項的無障礙屬性：該元素為連結、不帶 `aria-disabled`、
      無障礙名稱含「唯讀預覽」
- [x] 7.4 重跑既有的三組 CDP 驗證腳本，確認部門欄與表格寬度變更沒有破壞
      既有的篩選、搜尋、排序與結果筆數行為
- [x] 7.5 `openspec validate --changes` 通過
