## 0. 前置條件（實作前必須完成）

- [x] 0.1 由 schema owner 對 `reviewer-workbench-queue-detail` 執行 `openspec-sync-specs` 與
      `openspec-archive-change`。驗證方式：`openspec/specs/reviewer-workbench/spec.md` 存在，
      且 `openspec validate --changes workbench-filters-and-case-history` 對 MODIFIED 需求不再報找不到基準
- [x] 0.2 與 schema owner 確認部門欄位命名與型別（design Decision 5：`ExpenseCase.applicantDepartment String?`）。
      驗證方式：owner 在 PR 或 issue 上明確同意，且本 change 的 schema 改動只有這一個 nullable 欄位

## 1. Schema 與 migration（owner: @ChichiTung）

- [x] 1.1 `apps/api/prisma/schema.prisma` 的 `ExpenseCase` 新增 `applicantDepartment String?`（緊鄰
      `applicantCode`，附時點快照的註解）。驗證方式：`pnpm --filter api prisma:generate` 成功
- [x] 1.2 以 `pnpm --filter api prisma:migrate` 產生新 migration（**不得 `db push`**、**不得修改已 commit 的
      migration**）。驗證方式：`apps/api/prisma/migrations/` 下出現新資料夾，`git status` 顯示既有 migration 檔未被修改
- [x] 1.3 對空 DB 重跑 migrate 後再跑一次。驗證方式：第一次建出含新欄位的 schema，第二次回報 up to date，
      且既有案件資料（seed 前）不受影響

## 2. Shared：契約欄位（只加不改）

- [x] 2.1 `packages/shared/src/api.ts` 的 `caseListItemSchema` 新增 `department: z.string().nullable()`。
      驗證方式：`pnpm --filter shared typecheck` 通過，且既有欄位定義未被改動（`git diff` 只見新增行）
- [x] 2.2 `caseDetailSchema` 的 `applicant` 新增 `department`，並在頂層新增
      `disposition: { actorName, decidedAt, action, consistencyFlag } | null`（`action` 用 `reviewerActionSchema`、
      徽章用 `consistencyFlagSchema`）。驗證方式：`pnpm --filter shared typecheck` 通過
- [x] 2.3 新增 `caseHistoryResponseSchema`（每筆含 `id`、`caseNumber`、`applicationDate`、`amount`、
      `currency`、`status`、`caseStatus`、`isCurrent`）。驗證方式：`pnpm --filter shared typecheck` 通過

## 3. Shared：篩選、搜尋、排序與計數純函式（design Decision 1／9）

- [x] 3.1 新增 `packages/shared/src/presentation/queue-view.ts`：把 `apps/web/src/features/queue/model.ts`
      的 `queueItems` / `classificationCounts` 移進來，並新增 `filterQueue`、`caseStatusCounts`
      （計數皆為「先套用搜尋，再套用另一個維度，最後分組」）。驗證方式：`pnpm --filter shared typecheck` 通過
- [x] 3.2 在同一模組實作 `matchesSearch`（案件編號／申請人／部門／說明的子字串比對、不分大小寫、
      去前後空白、空字串視為未搜尋、**不用 regex**）。驗證方式：測試涵蓋大小寫、片段比對、
      含 `(`／`*` 的輸入不拋錯、只有空白時不縮減列表
- [x] 3.3 在同一模組實作 `sortQueue`（排序鍵為申請日期與案件編號、升降冪、穩定排序、
      案件編號自然排序、缺值排末尾且不被移除）。驗證方式：測試斷言 `EXP-2026-9` 排在 `EXP-2026-10` 之前、
      無申請日期的案件在兩個方向都排末尾且仍在結果中
- [x] 3.4 新增 `packages/shared/src/__tests__/queue-view.test.ts`：窮舉
      「分類（含 ALL）× 處理狀態（含 ALL）×（有／無搜尋）」的組合，斷言每個卡片計數等於
      「該分類 + 當前處理狀態 + 當前搜尋」篩選後的長度、每個處理狀態計數等於「該狀態 + 當前分類 + 當前搜尋」
      篩選後的長度、`REVIEW_CLOSED` 案件完全不計入任何計數，且變更排序後所有計數不變。
      驗證方式：`pnpm --filter shared test` 全數通過
- [x] 3.5 新增申請紀錄清單的呈現函式（依申請日期由新到舊排序、標示當前案件）與其測試。
      驗證方式：`pnpm --filter shared test` 涵蓋「含起點案件」「只有一筆時視為無其他紀錄」
- [x] 3.6 `packages/shared/src/i18n/zh-TW.ts` 補文案：處理狀態篩選標籤、「全部」卡片、搜尋框
      placeholder 與搜尋無結果、排序方向的無障礙說明、已結案頁面標題與空狀態、
      申請紀錄彈窗（申請人／部門／沒有其他紀錄／重試）、處置人與「查無處置紀錄」。
      驗證方式：`pnpm --filter shared test` 的 i18n 測試通過（每個新鍵都有文案、缺鍵仍回通用句）
- [x] 3.7 從 `packages/shared/src/index.ts` 匯出新模組並 `pnpm --filter shared build`。
      驗證方式：`pnpm --filter shared test && pnpm --filter shared typecheck` 通過，`dist` 可被 api require

## 4. Backend：列表篩選與詳情處置人

- [x] 4.1 `apps/api/src/cases/cases.service.ts` 的 `list` 新增 `caseStatus` 參數，在 Prisma `where` 上篩
      `ExpenseCase.status`（不是撈回後過濾），與既有 `status` 參數為 AND；列表項目帶出 `department`。
      驗證方式：`pnpm --filter api typecheck` 通過
- [x] 4.2 `apps/api/src/cases/cases.controller.ts` 接上 `caseStatus` query 參數。
      驗證方式：`curl "localhost:3000/api/cases?caseStatus=REVIEW_CLOSED"` 回傳帶 NORMAL run 的
      `EXP-2026-1043`（修正前此查詢取不到它）
- [x] 4.3 `detail` 新增 `dispositions: { orderBy: { createdAt: "desc" }, take: 1, include: { actor: true } }`，
      回傳處置人顯示名稱、時間、動作與**固化**徽章；無處置紀錄時回 `null`。
      驗證方式：`pnpm --filter api typecheck` 通過，且實作中未呼叫 `deriveConsistencyFlag`
- [x] 4.4 `detail` 的 `applicant.department` 改回傳實際欄位值（取代目前寫死的 `null`）。
      驗證方式：`curl` 某有部門的案件詳情，`applicant.department` 為該部門名稱
- [x] 4.5 擴充 `apps/api/src/cases/cases.service.spec.ts`（手寫 fake Prisma）：`caseStatus` 篩選傳入
      Prisma `where`、兩參數 AND、詳情回傳最新一筆處置的處置人與固化徽章、多筆處置取較晚那筆、
      無處置時為 `null`。驗證方式：`pnpm --filter api test` 通過

## 5. Backend：申請人／部門申請紀錄查詢

- [x] 5.1 新增 `GET /api/cases/:id/history?scope=applicant|department`：以起點案件的 `applicantCode`
      （無則 `applicantName`）或 `applicantDepartment`，在同一 `organizationId` 內查詢，依申請日期由新到舊，
      回應含起點案件本身並標示。驗證方式：`curl` `EXP-2026-2002` 的 applicant scope，回應包含該案自己
- [x] 5.2 `scope=department` 但該案未記錄部門時回 400；查無其他案件時回空清單而非 404。
      驗證方式：`curl` 一筆無部門的案件回 400、一個只有單筆案件的申請人回長度 1 的清單
- [x] 5.3 確認回應**不含**任何風險分數、頻率統計或結論性標記（`specs/review-api` 明文禁止）。
      驗證方式：code review 對照 `caseHistoryResponseSchema` 欄位清單，回應欄位不多於 schema
- [x] 5.4 補 `cases.service.spec.ts` 的紀錄查詢測試（依部門查詢、無部門 400、空清單、排序）。
      驗證方式：`pnpm --filter api test` 通過

## 6. Seed：真正的處置紀錄與部門資料

- [x] 6.1 `apps/api/prisma/seed/index.ts`：`EXP-2026-2001` 補 `Disposition`（`ACCEPT`、
      `finalAction = APPROVE`、徽章 `CONSISTENT`）與
      `REVIEWER_DISPOSITION` 稽核事件，`resultingStatus` 由 `resolveDisposition` 決定。
      驗證方式：`db:reset` 後 `GET /api/cases/:id/audit` 對該案回 `chainValid: true` 且事件依序。
      註：seed 以 strip-types 直接跑 `.ts`，無法載入 shared 的 CJS dist（同 `hash-chain.ts` 的既有處理），
      故徽章與 `resultingStatus` 以常數寫入並在呼叫處註明 `deriveConsistencyFlag` /
      `resolveDisposition` 的推導依據，與參照案件 1043 原本的做法一致
- [x] 6.2 `EXP-2026-2002` 補 `Disposition`（`ACCEPT` on `MANUAL_REVIEW` → escalate、
      `finalAction = MANUAL_REVIEW`、徽章 `ESCALATED`）與稽核事件。驗證方式：詳情的處置徽章為
      `ESCALATED`、處置人為 seed 的 reviewer，且與 API 對同一動作實際寫入的值一致。
      註：初版誤寫為 `finalAction = null` / `PENDING_DECISION`，該組合真實流程產不出來
      （`PENDING_DECISION` 只在 `HOLD` 出現，而 `HOLD` 回 `QUEUED`），已由端到端驗證抓到並修正
- [x] 6.3 案件補部門：至少兩筆同部門、至少一筆未記錄部門（走無值路徑），部門為模擬值。
      驗證方式：`db:reset` 後依部門查詢其中一個部門回多筆，另一案的 `applicant.department` 為 `null`
- [x] 6.4 `db:reset` 連跑兩次。驗證方式：兩次的案件編號、處置徽章與部門資料一致，且無 `TRUNCATE`／`DELETE`

## 7. Frontend：總覽篩選重構、搜尋與排序

- [x] 7.1 `apps/web/src/features/queue/model.ts` 改為引用 shared 的 `queue-view`（不在 web 保留第二份
      計數實作）。驗證方式：`pnpm --filter @expense-review-agent/web typecheck` 通過，`model.ts` 不再有計數邏輯
- [x] 7.2 `StatCards` 改為可點選的分類篩選控制項：「總案件數」卡片即「全部」且預設選取、
      選取時帶底色、再點分類卡片可取消、鍵盤可操作、`aria-pressed` 正確。
      驗證方式：點 EXCEPTION 卡片列表只剩 `EXP-2026-2002`；再點一次或點「全部」都回到全部，
      且任何時候恰有一張卡片帶選取底色
- [x] 7.3 `FilterChips` 改為依處理狀態篩選（含「全部」與各狀態計數）；**移除**分類 chip 列。
      驗證方式：畫面上不存在分類 chip（非隱藏），選「待補件」只剩 `EXP-2026-2003`
- [x] 7.4 新增搜尋輸入框於篩選列上方（controlled input、debounce 250ms、可清除）。
      驗證方式：輸入 `2002` 只剩該案；輸入 `exp-2026` 仍列出案件；輸入 `(` 不拋錯；清除後回到全部
- [x] 7.5 `CaseTable` 的申請日期與案件編號欄標題改為可點選排序（方向指示、`aria-sort`、鍵盤可操作）。
      驗證方式：點日期標題切換升降冪；點案件編號改以編號排序且日期欄不再顯示指示
- [x] 7.6 `QueuePage` 管理搜尋、兩個篩選與排序 state，一律以 shared 函式計算列表與兩組計數；
      空結果顯示空狀態並提供清除篩選與搜尋的入口。驗證方式：同時選 MISSING + 待補件只剩
      `EXP-2026-2003`；選 NORMAL + 待補件顯示空狀態與清除入口；套用搜尋後兩組計數與列表筆數一致
- [x] 7.7 切換篩選與搜尋時排序保留；變更排序時計數不變。驗證方式：改成案件編號升冪後點 EXCEPTION 卡片，
      列表仍依編號升冪，且卡片與 chip 的數字在切換排序前後相同
- [x] 7.8 列表未取得時兩組計數都不顯示數字。驗證方式：停掉 API 後卡片與 chip 皆無數字，列表顯示錯誤與重試

## 8. Frontend：已結案案件頁面

- [x] 8.1 `app/router.ts` 的 `Route` 擴為 `{ name: "queue" | "closed"; caseId }`，支援 `#/closed` 與
      `#/closed/:id`。驗證方式：手動改 hash 可切換，`#/closed/<id>` 重新整理後仍在已結案頁且抽屜開啟
- [x] 8.2 `app/AppShell.tsx` 在案件總覽下新增「已結案案件」選單項（移除該項的「即將推出」標示）。
      驗證方式：點選單可進入該頁，當前頁有選取樣式
- [x] 8.3 新增 `features/closed/ClosedCasesPage.tsx`，以 `caseStatus=REVIEW_CLOSED` 查詢（獨立 query key），
      列出案件編號、申請人、金額、分類徽章與結案標示，含載入／錯誤重試／空狀態。
      驗證方式：頁面顯示 `EXP-2026-1043`；案件總覽的列表與計數仍不含它
- [x] 8.4 已結案頁面沿用 shared 的搜尋與排序（同一組比對欄位與排序欄位、同一份預設排序），
      不顯示分類卡片與處理狀態篩選。驗證方式：該頁的搜尋與排序行為與總覽一致，
      且 `pnpm --filter @expense-review-agent/web typecheck` 通過（沒有第二份實作）
- [x] 8.5 已結案案件可開啟詳情抽屜且不顯示處置按鈕。驗證方式：從該頁點開 `EXP-2026-1043`，
      顯示結案歷程與處置人，無處置按鈕

## 9. Frontend：處置人與申請紀錄彈窗

- [x] 9.1 `features/detail/DispositionPanel.tsx` 在「目前處理狀態」同一列右側顯示處置人與處置時間；
      流程狀態非 `QUEUED` 但無處置紀錄時顯示「查無處置紀錄」，不顯示任何人名。
      驗證方式：`EXP-2026-2001` 顯示 seed reviewer 與時間；手動把某案改為無處置紀錄時顯示查無
- [x] 9.2 `features/detail/ApplicantInfo.tsx` 的申請人與部門改為可點選（無部門時不可點選、顯示「—」）。
      驗證方式：無部門的案件該欄不可聚焦、不可點選
- [x] 9.3 新增 `features/detail/CaseHistoryDialog.tsx`：顯示案件編號、申請日期、金額、分類徽章、處理狀態，
      標示當前案件，可點選切換抽屜，Esc 與關閉按鈕可關，沿用 `useModalBehavior` 的焦點管理。
      驗證方式：點申請人開啟清單、點另一筆案件後抽屜切換為該案
- [x] 9.4 彈窗的載入中、錯誤重試、「沒有其他申請紀錄」狀態。驗證方式：停掉 API 後顯示錯誤與重試，
      而非「沒有紀錄」
- [x] 9.5 確認彈窗**不出現**風險分數、頻率警示或任何指控性文案。驗證方式：code review 對照
      `specs/reviewer-workbench` 的「不呈現風險判定」scenario，且 i18n 新增文案中無此類措辭

## 10. 整合驗證

- [x] 10.1 repo 根目錄執行 `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`。
      驗證方式：全部通過（CI 對等）
- [x] 10.2 本機 `docker compose up -d`、`pnpm --filter api db:reset`、`pnpm dev:api`、`pnpm dev:web`，
      逐項對照 `specs/reviewer-workbench` 與 `specs/review-api` 的每個 scenario（含交叉篩選計數、
      搜尋與排序、已結案頁面、處置人、申請紀錄彈窗）。驗證方式：以 headless Chrome（CDP 腳本）實際操作，
      全數通過
- [x] 10.3 計數一致性專項驗證（依第 11 組修訂後的不變量）：在多個搜尋字串下，逐一點開每張卡片
      與每個處理狀態，確認①統計卡片的數字恆定不變、②結果筆數等於列表實際筆數。
      驗證方式：CDP 腳本比對 42 組組合，無一不符
- [x] 10.4 送出一次新的處置後確認處置人即時出現、列表處理狀態同步更新、
      `GET /api/cases/:id/audit` 新增事件且 `chainValid: true`。驗證方式：同上腳本涵蓋
- [x] 10.5 確認既有行為未回歸：非通過檢查仍顯示證據、疑似措辭不變、處置按鈕仍只來自共用矩陣、
      徽章仍取自後端。驗證方式：重跑前一個 change 仍適用的 scenario

## 11. 修訂：固定的統計卡片與單一結果筆數

> 背景：原設計讓兩組計數交叉反映，畫面上有 9 個會跳動的數字。改為「卡片固定總覽 +
> chip 無計數 + 單一『共 N 筆』」以降低認知負荷（見 design Decision 1 的修訂段落）。

- [x] 11.1 `packages/shared/src/presentation/queue-view.ts`：`classificationCounts` 改為不收 `query`
      參數（只在基底層計算）、移除 `caseStatusCounts`、`buildQueueView` 改回傳 `resultCount`
      並移除 `caseStatus` 計數。驗證方式：`pnpm --filter shared typecheck` 通過
- [x] 11.2 改寫 `queue-view.test.ts` 的不變量：斷言 `classificationCounts` 對任何
      分類／處理狀態／搜尋組合都回傳相同結果，且 `resultCount === items.length`（窮舉同一組組合）。
      驗證方式：`pnpm --filter shared test` 全數通過
- [x] 11.3 `i18n/zh-TW.ts` 新增結果筆數文案（`queue.resultCount`，含 0 筆的情況）並補進 i18n 測試。
      驗證方式：`pnpm --filter shared test` 通過
- [x] 11.4 `StatCards` 改用固定計數（不再接收處理狀態或搜尋）；`FilterChips` 移除 `chip__count`
      與 `counts`／`total` props。驗證方式：畫面上 chip 不含任何數字
- [x] 11.5 `QueuePage` 在篩選列與列表之間顯示「共 N 筆」，並確認卡片數字在套用任何條件後不變。
      驗證方式：依序套用處理狀態、分類、搜尋，四張卡片與待審總數的數字都不變，
      「共 N 筆」等於列表筆數
- [x] 11.6 已結案頁面同步顯示結果筆數（沿用同一個元件與文案）。驗證方式：該頁搜尋後筆數正確
- [x] 11.7 重跑五關與端到端驗證（含固定卡片與結果筆數的專項斷言）。
      驗證方式：CI 五關全綠、CDP 腳本全數通過
