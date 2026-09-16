## Context

動機見 `proposal.md` 的 Why，行為契約見 `specs/reviewer-workbench/spec.md` 與
`specs/review-api/spec.md`。以下只列會影響做法的現況：

- `apps/web` 是 Vite 樣板。已有 React 19、TanStack Query 5、Zod 4，**沒有** router、測試框架，
  也還沒相依 `@expense-review-agent/shared`。本 change 已確認不新增 npm 套件。
- `packages/shared` 的 `package.json` `exports` 有 `development` 條件指向 `src/index.ts`，
  預設則指向 CommonJS `dist`。shared 的測試用 `node --experimental-strip-types --test`，
  直接 import `.ts` 檔。現有 `domain/disposition.ts` 只有 type-only 的相對 import。
- API 詳情的 `messageParams` 在現有 seed 中都是空物件；`suggestion.reasonKey` 在 seed 沒設
  `summaryKey`，會退回成 `suggestion.<CLASSIFICATION>`。檢查的 `messageKey` 目前有
  `rule.R1.PASS`、`rule.R7.FAIL`、`rule.R4.FAIL`、`rule.guard.eligibility.ABSTAIN`。
- 參考 HTML 是純 CSS radio hack，無 JS。版型 token（色票、字級、間距）可以直接沿用。

## Goals / Non-Goals

**Goals:**

- 前端的判定相關邏輯（結果語氣、疑似措辭、處置選項、請求組裝、理由要求）全部是 shared 裡可用
  `node --test` 測的純函式，React 元件只負責渲染與事件。
- 視覺上與參考 HTML 一致，看起來是同一個產品。
- API 契約只加不改。

**Non-Goals:**

- 費用規範頁、稽核軌跡頁、主管稽核、重跑 Agent run（本輪不做，側邊選單只顯示入口）。
- 暗色主題、手機版版面（抽屜在窄螢幕改為全寬即可，不另做行動版設計）。
- 登入與角色切換（M1 無認證，後端使用固定 demo actor）。
- 修改 `schema.prisma`、`packages/shared/src/domain/`。seed 只補參照案件 `EXP-2026-1043` 的完整結案歷程
  （見 Decision 11），不調整其他案件的流程狀態。
- 後端阻擋對非 `QUEUED` 案件的重複處置（屬領域行為變更，另開 change；本輪由前端依流程狀態隱藏按鈕）。

## Decisions

**1. 呈現邏輯放 `packages/shared/src/presentation/`，文案放 `packages/shared/src/i18n/zh-TW.ts`**

- `presentation/check-view.ts`：`RuleOutcome` → `tone`（`ok | fail | attention`）。只有 `PASS` 回 `ok`，
  其餘三個非通過回 `attention`；此函式採窮舉 switch，新增 outcome 時編譯會失敗。
  另依 `isSuspicionOnly` 決定標題，非通過時一律加「疑似」前綴；理由文案若不含「疑似」（或鍵缺漏），
  改用 `outcome.FAIL.suspicion` 疑似通用句保底。
  這是 CLAUDE.md 規則 3 在顯示層的落地。
- `presentation/disposition-options.ts`：`dispositionOptions(recommendation)` 以 `permittedActions()`
  為唯一來源，把每個動作對應到文案鍵、按鈕樣式、`needsConfirm`、`opensJudgementDialog`。
  `buildDispositionRequest()` 只在 `MANUAL_JUDGEMENT` 帶入 `finalAction`。`isReasonRequired()` 取
  `resolveDisposition().reasonRequired` 與 `deriveConsistencyFlag().reasonRequired` 的聯集，與後端判斷
  相同。這裡只用 `reasonRequired` 決定欄位是否必填，**不把算出的 flag 顯示出來**；徽章一律顯示後端
  回傳值（CLAUDE.md「不得在 UI 端即時重算」）。
- `presentation/money.ts`：純字串格式化（正規表示式加千分位），不經 `Number`。
- `i18n/format.ts`：`t(key, params, fallbackKey)` 以 `{name}` 插值；鍵不存在時改用 fallbackKey，再不行
  回傳通用句，永遠不回傳原始鍵。

替代方案：放在 `apps/web/src/lib`。否決，原因有二：CLAUDE.md 規定領域邏輯放 shared；web 沒有測試框架，
放在 shared 可以直接沿用 `node --test`，不必新增套件。

**2. shared 新模組的相對 import 規範**

`node --test` 直接執行 `.ts`，需要帶副檔名的相對 import；CommonJS build（`tsconfig.build.json`）則不能
含 `.ts` 副檔名。新模組依以下方式處理：

- 需要 runtime 值的跨檔 import（例如 `presentation` 用 `permittedActions`），與現有測試同樣直接 import
  `../domain/disposition.ts`，並在 `tsconfig.build.json` 啟用 `rewriteRelativeImportExtensions`
  （TypeScript ≥ 5.7，repo 使用 5.x）。
- 若 build 設定改動造成 api 端執行問題，退回做法是讓 `presentation` 保持零 runtime 相對 import，
  由呼叫端注入 `permittedActions`。

這是實作時第一個要驗證的點（見 tasks 1.1）。

**3. Vite 解析 shared 走 `development` 條件（src）**

`vite.config.ts` 設定 `resolve.conditions` 包含 `development`，dev 與 build 都吃 shared 的 TS 原始碼。
這樣可以避免 Rollup/Rolldown 打包 CommonJS `dist` 時的 interop 問題，也不必在改 shared 後記得先 build
才能看到前端變化。web 的 `tsc -b` 會透過同一個 `exports` 解析型別。

替代方案：吃 `dist`。否決，理由是 CJS interop 風險，以及 PROJECT_STATUS 已記錄「忘記 build shared」是
常見踩雷點。

**實作補充：前端改用 `@expense-review-agent/shared/browser` 子路徑。** shared 的 `index.ts` 會轉出
`hash-chain.ts`，它 import `node:crypto`。Vite 會把這個模組在瀏覽器端換成「一讀取就拋錯」的 Proxy，
dev 模式下模組一載入就讀 `createHash`，整個 app 會起不來（build 靠 tree-shaking 才碰巧沒事）。
因此新增 `src/browser.ts` 作為不含 hash-chain 的入口，`index.ts` 改為轉出 `browser.ts` 再加上
hash-chain。後端的 import 路徑不受影響。替代方案是在 web 用 alias 把 `node:crypto` 換成 stub。否決，
因為那等於把 Node 專用程式碼偷偷送進瀏覽器 bundle。

**4. 路由：hash 自行實作**

`#/cases`（總覽）、`#/cases/:id`（總覽加開啟抽屜）。以 `useSyncExternalStore` 訂閱 `hashchange`，
約 40 行。路由數量只有兩個，不值得引入 react-router（已確認不加套件）。未來頁面變多時再評估。

**5. 資料層：TanStack Query + shared Zod 驗證**

- `api/client.ts`：`fetch` 包裝，路徑前綴 `/api`，回應以 shared schema `parse`。非 2xx 時解析 NestJS 的
  `{ message }` 並拋出 `ApiError(status, message)`。
- Query keys：`["cases","summary"]`、`["cases","list"]`、`["cases",id]`、`["cases",id,"related"]`。
  列表一次取全部，分類篩選在前端做（案件數少，也讓 chip 計數與列表共用同一份資料，避免兩次請求期間
  數字不一致）。
- 處置 mutation 成功後，將 `["cases"]` 前綴全部 invalidate。
- 開發時 `vite.config.ts` 的 `server.proxy` 把 `/api` 導向 `http://localhost:3000`，前端不硬編主機。

**6. 待審總數與預設列表**

列表以 `caseStatus !== "REVIEW_CLOSED"` 過濾；卡片與 chip 的計數**由同一份過濾後的列表計算**，
待審總數為四分類相加。這樣卡片、chip、列表三者必然一致。

（修訂）原本卡片取自 `GET /cases/summary`。但 summary 以「有 run 用分類、否則用流程狀態」歸類，
參照案件 `EXP-2026-1043` 補上完整結案 run 後會被算進 NORMAL，造成卡片顯示 2、列表只有 1。
替代方案是讓後端 summary 排除 `REVIEW_CLOSED`，但那會改動 review-api 的行為。經討論後選擇只改前端，
不動 API；`/cases/summary` 目前前端不再使用。

**7. HUMAN 三段式由檢查結果推導，不等後端 `humanAnalysis`**

API_SPEC 提到的 `humanAnalysis` 未實作。前端依 `checks` 分組：已完成為 `tone=ok` 的檢查、無法確定為
`tone=attention` 的檢查（附證據）、建議為固定文案「此案涉及 Agent 無法確定的判斷，建議 Reviewer 綜合
業務情境後決定」。這是分組呈現，不產生任何新判定。後端日後補上 `humanAnalysis` 時可替換資料來源。

**8. 元件結構（`apps/web/src/`）**

```
main.tsx                 QueryClientProvider + App
app/AppShell.tsx         頂列 + 側邊選單 + <main>
app/router.ts            hash 路由 hook
api/client.ts, api/queries.ts
features/queue/          QueuePage, StatCards, FilterChips, CaseTable
features/detail/         CaseDrawer, ApplicantInfo, CheckList, SuggestionPanel,
                         RelatedCases, DispositionPanel, JudgementDialog, ConfirmDialog
components/              Badge（分類／處理狀態／一致性徽章）、ErrorState、Spinner
styles/tokens.css, styles/app.css   從參考 HTML 移植的 token 與樣式
```

樣式採純 CSS 加 BEM 風格 class，沿用參考 HTML 的色票與尺寸。不引入 CSS-in-JS 或 Tailwind（屬新套件）。

**9. 無障礙與互動**

列表列用 `<button>` 或帶 `role="button"` 與 `tabIndex`，支援 Enter／Space。抽屜用 `role="dialog"`、
`aria-modal`，開啟時聚焦標題，Esc 關閉，關閉後焦點回到觸發列。modal 同理，並鎖住背景捲動。
尊重 `prefers-reduced-motion`（參考 HTML 已有進場動畫）。

**10. 後端 `caseStatus`**

`CasesService.list` 與 `detail` 在回應物件加上 `caseStatus: c.status`，shared schema 加
`caseStatus: caseStatusSchema`。補 `cases.service.spec.ts`（jest，手寫 fake Prisma，與
`review.service.spec.ts` 同作法）。

**11. 參照案件 `EXP-2026-1043` 補上完整結案歷程（seed）**

原本 1043 只有案件主檔，從 2002 的疑似重複證據點進去只看到「尚無 Agent 初審結果」，demo 缺乏說服力。
補上：明細（餐費／餐廳 B／單號 INV-2026-0805-77／2026-08-05，與 2002 的證據吻合）、收據與
`ReceiptLineLink`、NORMAL run 與 R4／R5／R7 全數 PASS 的規則結果、Reviewer `ACCEPT`（決策當下建議
APPROVE → 最終 APPROVE → `CONSISTENT`，與 shared `deriveConsistencyFlag` 一致）、主管 `APPROVE`，
以及依時間順序、以歷史時間戳記計算 hash 的稽核事件。2002 的明細同步補上相同單號。PASS 結果依治理
約束不需證據。seed 無法直接執行 shared 的 CJS dist，徽章值以常數寫入並以註解標明依據。

## Risks / Trade-offs

- [seed 只有一筆 `QUEUED` 案件，demo 能操作的處置很少] → 前端依規格正確隱藏按鈕，不為 demo 放寬；
  在 proposal 的 Impact 與下方 Open Questions 提出，由 seed owner 決定。
- [`rewriteRelativeImportExtensions` 改動 shared build 設定可能影響 api 執行] → tasks 1.1 先驗證
  `pnpm --filter shared build` 加 `pnpm dev:api` 可以啟動；不行就改用 Decision 2 的注入退路。
- [i18n 文案鍵與後端 messageKey 漂移] → shared 測試斷言目前 seed 用到的所有 messageKey 與
  `suggestion.<CLASSIFICATION>` 都有文案；缺鍵時 UI 仍有通用句保底。
- [前端只靠流程狀態隱藏按鈕，後端並未阻擋重複處置] → 按鈕在 mutation 期間停用、成功後立即
  invalidate；後端防線列為後續 change。
- [列表一次取全部] → M1 demo 案件數在 10 筆級，可以接受；分頁屬後續需求。
- [Docker 未啟動時無法做端到端驗證] → 單元測試不依賴 DB；tasks 最後一段的手動驗證需要本機起
  Postgres。

## Migration Plan

1. shared：先確認 build 設定可行，再加 i18n、presentation、`caseStatus` 與測試；`pnpm --filter shared test` 通過後 build。
2. api：`caseStatus` 加 spec 測試。
3. web：移除樣板，依序完成 shell、總覽、抽屜、處置。
4. 四關：`pnpm lint && pnpm typecheck && pnpm test && pnpm build`（含 `format:check`，CI 會跑）。
5. 手動端到端驗證：`db:reset`、`dev:api`、`dev:web`，逐一開啟各案。

回滾：revert PR。API 改動是純加法，舊的呼叫端不受影響；不涉及 DB。

## Open Questions

- seed 是否要把 `EXP-2026-2001` 至 `2003` 的流程狀態改回 `QUEUED`，讓 demo 能完整操作三種建議的
  處置？這不影響本 change 的規格與任務，由 seed owner（成員 C／schema owner）決定。
- 詳情的 `department` 目前固定為 null。前端顯示「—」，待後端或 schema 補欄位後自動生效。
