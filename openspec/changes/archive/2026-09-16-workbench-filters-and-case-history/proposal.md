## Why

M1-U1 的初審工作台目前只有「依 Agent 分類」一個篩選維度，初審人員無法回答「哪些案件還等我處理」
這個每天最常問的問題——處理狀態（`QUEUED` / `AWAITING_INFO` / `DISPOSED`）只能逐列用眼睛看，
已結案案件則被完全排除在畫面之外，無處可查。

同時 M1-U2（主管可追溯 Agent 與人工判斷）有一個實際的斷點：案件詳情顯示「目前處理狀態：已處置」，
但**沒有顯示是誰處置的**。`Disposition` 表已經記了 `actorId`、`createdAt`、`action` 與固化的
`consistencyFlag`，只是 `GET /api/cases/:id` 沒有回傳，前端也無從呈現。更糟的是 seed 為了做出
「已處置」的畫面，直接把 `EXP-2026-2001` / `2002` 的 `status` 寫成 `DISPOSED` 卻沒有建立任何
`Disposition` 記錄——demo 資料裡存在「查不到處置人的已處置案件」，這個狀態在真實流程中不可能出現
（只有 Reviewer 送出處置才會寫入 `DISPOSED`），會讓主管稽核的示範失去說服力。

本 change 服務 **M1**，主要是 **M1-U1**（初審人員依 Agent 結果完成初審）與 **M1-U2**
（財務主管可追溯 Agent 與人工判斷）。

## What Changes

**1. 案件詳情顯示處置人（M1-U2 追溯性）**

- `GET /api/cases/:id` 新增回傳該案最新一筆 `Disposition` 的處置人顯示名稱、處置時間、Reviewer 動作
  與固化的一致性徽章（唯讀，沿用既有 append-only 資料，**不新增稽核欄位、不重算徽章**）。
- 詳情抽屜「目前處理狀態」那一列右側顯示處置人與時間。
- seed 為 `EXP-2026-2001` / `2002` 補上真正的 `Disposition` 記錄與對應稽核事件，
  取代目前直接寫死的 `DISPOSED` 狀態。

**2. 篩選維度重構**（**BREAKING**：改變已驗證的總覽互動行為）

原本的統計卡與 chip 顯示的是同一組數字、同一個篩選維度，使用者看到兩排重複的東西。合併後
每一排各自負責一個維度。

- **移除**「依 Agent 分類篩選」的 chip 列。
- 「案件統計」的 stat 卡片本身變成分類篩選按鈕（可按、可取消、選取時帶底色）。
  既有的「總案件數」卡片即「**全部**」選項，預設為選取狀態——任何時候恰有一張卡片為選取狀態，
  不會出現「四張都沒選、使用者無從判斷當前範圍」的空窗。
- 原 chip 列改為依**處理狀態**篩選（待審 / 待補件 / 已處置…）。
- 兩個維度可同時套用，為 AND 條件。
- **畫面上只有一個會變動的數字**：統計卡片的計數是固定的總覽（待審案件的分類分佈，
  不隨篩選或搜尋改變）、處理狀態控制項不帶數字，篩選列與列表之間顯示單一的
  「共 N 筆」反映當前結果。原本讓兩組計數交叉反映會有 9 個一直跳動的數字，
  認知負荷高且使用者不敢信任那些數字。

**3. 新增「已結案案件」頁面**

- 案件總覽主選單下新增獨立頁面，列出 `REVIEW_CLOSED` 案件（預設列表仍排除它們）。
- 後端 `GET /api/cases` 新增獨立的 `caseStatus` 篩選參數。現有的 `status` 參數比對的是
  「有 run 用分類、沒 run 用案件狀態」的混合欄位，導致帶有 Agent run 的 `REVIEW_CLOSED`
  案件篩不到——這是既有缺陷，本 change 一併修正（`status` 參數語意不變，只加新參數）。

**4. 申請人／部門申請紀錄彈窗**

- 詳情抽屜的申請人與部門可點選，彈出該申請人或該部門的案件紀錄（唯讀清單）。
- 新增依申請人／部門查詢案件的 API。
- **schema 變更**（已取得 schema owner 同意）：`ExpenseCase` 新增部門欄位。
  目前 `applicant.department` 永遠是 `null`，沒有任何資料來源。
- **範圍界線**：彈窗只做唯讀的歷史清單，**不計算風險分數、不做跨案件風險判定**——
  那是 M2 風險情報的範圍。

**5. 案件搜尋與排序**

- 篩選列上方新增單一搜尋輸入框，以子字串模糊比對案件編號、申請人、部門與說明（不分大小寫）。
- 搜尋是**基底集合**的篩選，反映在結果筆數上，但不改變固定的統計卡片數字。
- 列表可依**申請日期**或**案件編號**排序，點欄位標題切換升／降冪，一次一個排序鍵，附方向指示；
  預設申請日期由新到舊；切換篩選時保留當前排序。
- 搜尋與排序在前端那份已取得的列表上進行（M1 是 demo 規模、無分頁），**不新增 API 參數**；
  已結案案件頁面沿用同一組實作。

## Capabilities

### New Capabilities

（無）本 change 不引入新 capability，全部是既有 capability 的需求變更。

### Modified Capabilities

- `reviewer-workbench`: 統計卡片改為分類篩選按鈕（含「全部」卡片與選取狀態）、chip 改為處理狀態篩選、
  兩維度 AND 套用、固定卡片計數與單一結果筆數、新增搜尋與排序、新增已結案案件頁面、詳情顯示處置人、
  申請人／部門申請紀錄彈窗。
- `review-api`: 案件詳情回傳最新處置人資訊；列表新增 `caseStatus` 篩選參數；
  新增依申請人／部門查詢案件紀錄的端點。
- `data-model`: `ExpenseCase` 新增部門欄位。
- `demo-seed`: `EXP-2026-2001` / `2002` 以真正的 `Disposition` 記錄取代寫死的 `DISPOSED` 狀態；
  案件補部門資料。

> **前置條件**：`reviewer-workbench` 目前只存在於 `reviewer-workbench-queue-detail` 的 delta spec，
> 尚未同步進 `openspec/specs/`。本 change 的 delta 以 MODIFIED 表述，需先由 schema owner 對前一個
> change 執行 `openspec-sync-specs`（與 archive），本 change 的 spec 才有可套用的基準。

## Impact

**schema / DB**（owner: @ChichiTung）

- `apps/api/prisma/schema.prisma`：`ExpenseCase` 新增部門欄位。
- 新增一個 migration（**不得修改已 commit 的 migration**）。

**後端** `apps/api`

- `src/cases/cases.service.ts`：`detail` 加 join `Disposition` + `User`；`list` 新增 `caseStatus`
  參數；新增申請人／部門查詢方法。
- `src/cases/cases.controller.ts`：新增查詢參數與端點。
- `prisma/seed/index.ts`：2001／2002 補 `Disposition` 與稽核事件、案件補部門。

**shared** `packages/shared`

- `src/api.ts`：`caseDetailSchema` 新增處置人欄位、`caseListItemSchema` 新增部門欄位、
  新增申請紀錄回應 schema（**只加不改**，前端已依賴現有欄位）。
- `src/i18n/zh-TW.ts`：處理狀態篩選、搜尋與排序、已結案頁面、申請紀錄彈窗的文案。
- `src/presentation/`：篩選、搜尋、排序與計數的純函式（同一模組、同一份測試）。
- 既有 enum 與 `domain/disposition.ts` 矩陣**不動**。

**前端** `apps/web`

- `features/queue/`：`StatCards` 變可點選（含「全部」卡片）、`FilterChips` 改處理狀態、
  新增搜尋輸入框、`CaseTable` 表頭可排序、`model.ts` 改為引用 shared。
- 新增已結案案件頁面與路由（`app/router.ts` 新增 hash 路由）、`app/AppShell.tsx` 選單項目。
- `features/detail/`：`DispositionPanel` 顯示處置人、`ApplicantInfo` 可點選並開啟申請紀錄彈窗。

**測試**

- 篩選、搜尋、排序與計數邏輯、申請紀錄分組屬呈現邏輯，放 `packages/shared` 以 `node --test` 測。
- `apps/api` 補 `cases.service` 的 `caseStatus` 篩選與處置人回傳測試。

**不在本 change 範圍**

- 規則引擎判定深度、案件狀態機防護（非 `QUEUED` 不可處置、主管核可推進 `REVIEW_CLOSED`）、
  主管稽核 UI、稽核軌跡頁、費用規範頁、重跑 run。
- 任何跨案件風險計算（M2）。
- 列表分頁與伺服器端搜尋／排序（案件量還在 demo 規模；要做另開 change）。
