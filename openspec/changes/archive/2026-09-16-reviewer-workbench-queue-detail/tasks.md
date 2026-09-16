## 1. Shared：契約欄位與模組基礎

- [x] 1.1 驗證 shared 新模組的 import 作法（design Decision 2）：啟用 `rewriteRelativeImportExtensions`，或改用注入退路。驗證方式：`pnpm --filter shared build` 產出的 `dist` 可以被 `pnpm dev:api` 正常 require，且 `pnpm --filter shared test` 仍全數通過
- [x] 1.2 `packages/shared/src/api.ts` 的 `caseListItemSchema`、`caseDetailSchema` 新增 `caseStatus: caseStatusSchema`（只加不改）。驗證方式：`pnpm --filter shared typecheck` 通過

## 2. Shared：i18n 與呈現邏輯（純函式 + node --test）

- [x] 2.1 新增 `packages/shared/src/i18n/zh-TW.ts` 與 `i18n/format.ts`（插值、fallbackKey、通用句保底，永不回傳原始鍵），涵蓋分類、建議、流程狀態、一致性徽章、Reviewer 動作、規則名稱、seed 現有的 messageKey、`suggestion.<CLASSIFICATION>`。驗證方式：測試斷言插值正確、缺鍵回通用句、seed 現有的每個 messageKey 都有文案
- [x] 2.2 新增 `presentation/check-view.ts`（outcome → tone 窮舉、疑似類規則未通過一律「疑似」措辭、非通過且無證據標為 `evidenceMissing`）。驗證方式：測試涵蓋五種 outcome、`isSuspicionOnly` 未通過時標題含「疑似」、GATED/ABSTAIN/PENDING_HUMAN 不為 `ok`
- [x] 2.3 新增 `presentation/disposition-options.ts`（`dispositionOptions`、`buildDispositionRequest`、`isReasonRequired`，以 `permittedActions`／`resolveDisposition`／`deriveConsistencyFlag` 為唯一來源；`MANUAL_REVIEW + ACCEPT` 文案為轉呈主管）。驗證方式：測試窮舉三種建議的動作集合與矩陣一致、只有 `MANUAL_JUDGEMENT` 帶 `finalAction`、理由必填與後端規則一致
- [x] 2.4 新增 `presentation/money.ts`（字串千分位、非 TWD 顯示幣別代碼、不經 `Number`），以及 HUMAN 三段式分組函式。驗證方式：測試涵蓋 `"12345.50"`、`"800"`、`null`、USD，以及分組只依 tone 不產生新判定
- [x] 2.5 從 `packages/shared/src/index.ts` 匯出新模組，並 `pnpm --filter shared build`。驗證方式：`pnpm --filter shared test && pnpm --filter shared typecheck` 通過

## 3. Backend：詳情與列表帶出 caseStatus

- [x] 3.1 `apps/api/src/cases/cases.service.ts` 的 `list`、`detail` 回應新增 `caseStatus`。驗證方式：`pnpm --filter api typecheck` 通過
- [x] 3.2 新增 `apps/api/src/cases/cases.service.spec.ts`（手寫 fake Prisma）：分類與流程狀態為獨立欄位、無 run 的參照案件 `caseStatus` 為 `REVIEW_CLOSED`、既有 `status` 值不變。驗證方式：`pnpm --filter api test` 通過

## 4. Frontend：專案骨架

- [x] 4.1 移除 Vite 樣板（`App.tsx` 計數器、`App.css`、`assets/*`）；`apps/web/package.json` 加入 `@expense-review-agent/shared: workspace:*`，`test` script 維持無測試；`index.html` 改 `lang="zh-Hant"` 與產品標題。驗證方式：`pnpm install` 無新增外部套件（lockfile 只多 workspace link）
- [x] 4.2 `vite.config.ts` 設定 `resolve.conditions` 含 `development`、`server.proxy` 把 `/api` 導到 `localhost:3000`。驗證方式：`pnpm --filter @expense-review-agent/web build` 成功，且產物不含 shared 的 CJS interop 錯誤
- [x] 4.3 移植參考 HTML 的樣式到 `styles/tokens.css`、`styles/app.css`；建立 `app/AppShell.tsx`（頂列、側邊選單，「費用規範」「稽核紀錄」標示即將推出）與 `app/router.ts`（hash 路由 `#/cases`、`#/cases/:id`）。驗證方式：dev server 畫面與參考 HTML 的頂列與側邊選單一致，手動改 hash 可切換
- [x] 4.4 建立 `api/client.ts`（Zod parse、`ApiError` 解析 NestJS message）與 `api/queries.ts`（summary、list、detail、related、disposition mutation，成功後 invalidate `["cases"]`）。驗證方式：`pnpm --filter @expense-review-agent/web typecheck` 通過

## 5. Frontend：案件總覽

- [x] 5.1 實作 `StatCards`（四分類計數與建議文案、待審總數為四分類相加）與 `FilterChips`（全部加四分類、附計數、選取樣式）。驗證方式：對照 seed，NORMAL/MISSING/EXCEPTION/HUMAN 各顯示 1，待審總數顯示 4
- [x] 5.2 實作 `CaseTable`（八欄、排除 `REVIEW_CLOSED`、EXCEPTION 金額標紅、處理狀態徽章、列可用鍵盤開啟），以及載入中、錯誤加重試、空狀態。驗證方式：點選 EXCEPTION chip 只剩 `EXP-2026-2002`；停掉 API 後顯示錯誤與重試，而不是空列表

## 6. Frontend：案件詳情抽屜

- [x] 6.1 實作 `CaseDrawer` 外框（遮罩、關閉按鈕、Esc、焦點管理、hash 同步、404 與格式錯誤狀態）與 `ApplicantInfo`（缺值顯示「—」）。驗證方式：以 `#/cases/<id>` 重新整理會直接開啟抽屜；不存在的 id 顯示「找不到案件」
- [x] 6.2 實作 `CheckList`（shared `check-view` 輸出 ✅/❌/⚠️、白話理由、證據片段、證據缺漏警示、關聯案件可點選），不渲染信心度、五態原始值、§ 條號。驗證方式：`EXP-2026-2002` 顯示「疑似」措辭與可點選的 `EXP-2026-1043`；`EXP-2026-2004` 顯示 ⚠️「需人工確認」
- [x] 6.3 實作 `SuggestionPanel`（三桶配色、理由、適用規範原文、HUMAN 三段式、「Agent 建議非最終決定」提示、無 run 時的空狀態）與 `RelatedCases`。驗證方式：`EXP-2026-2003` 顯示建議補件與「單筆金額 ≥ NT$5,000 須附正式發票」；點開 `EXP-2026-1043` 顯示尚無 Agent 初審結果

## 7. Frontend：Reviewer 處置

- [x] 7.1 實作 `DispositionPanel`：只在 `caseStatus === "QUEUED"` 時由 `dispositionOptions` 產生按鈕，其他狀態顯示處理狀態文字。驗證方式：`EXP-2026-2004`（QUEUED、MANUAL_REVIEW）顯示「轉呈主管／退回補件／人工判斷／暫緩處理」；`EXP-2026-2001`（DISPOSED）不顯示按鈕
- [x] 7.2 實作 `ConfirmDialog` 與 `JudgementDialog`（最終結論三選一、理由必填規則走 `isReasonRequired`、空白理由不可送出、送出中停用），請求一律經 `buildDispositionRequest`。驗證方式：人工判斷未填理由時送出鈕停用；暫緩處理不填理由可以送出
- [x] 7.3 處置成功時顯示後端回傳的 `resultingStatus` 與一致性徽章文案（不重算）；400 時在處置區顯示後端訊息。驗證方式：在 QUEUED 案件送出人工判斷後，徽章與回應 JSON 的 `consistencyFlag` 一致，列表處理狀態同步更新

## 8. 整合驗證

- [x] 8.1 在 repo 根目錄執行 `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`，並確認全部通過（CI 對等）。註：`format:check` 唯一的 warning 是 repo 根目錄尚未 commit 的參考檔 `AI 費用單據初審 Agent.html`，不屬本 change、不進 CI
- [x] 8.2 本機 `docker compose up -d`、`pnpm --filter api db:reset`、`pnpm dev:api`、`pnpm dev:web`，逐一開啟 5 筆 seed 案件並對照 `specs/reviewer-workbench/spec.md` 各 scenario。至少實際送出一次處置，並以 `GET /api/cases/:id/audit` 確認新增 `REVIEWER_DISPOSITION` 事件、`chainValid: true`。註：以 headless Chrome（CDP 腳本）實際操作驗證 39 項 scenario 全數通過

## 9. 參照案件完整資料與統計修訂

- [x] 9.1 seed：`EXP-2026-1043` 補上明細、收據與連結、NORMAL run 與 R4／R5／R7 PASS 規則結果、Reviewer `ACCEPT`（`CONSISTENT`）、主管 `APPROVE`，以及依時間順序的 hash-chained 稽核事件；2002 明細補上單號 `INV-2026-0805-77`。驗證方式：`db:reset` 成功，且 `GET /api/cases/:id/audit` 對 1043 回傳 `chainValid: true`、事件依序排列
- [x] 9.2 前端：卡片與 chip 計數改由過濾後的列表計算，列表未取得時不顯示計數，並移除前端對 `/cases/summary` 的依賴。驗證方式：1043 帶 NORMAL run 後，NORMAL 卡片仍為 1、待審總數仍為 4，`pnpm --filter @expense-review-agent/web typecheck` 通過
- [x] 9.3 重跑四關與 E2E：從 2002 證據點開 1043，會顯示結案明細、全數通過的檢查、「已結案」狀態，且不顯示處置按鈕。驗證方式：CDP 腳本全數通過
