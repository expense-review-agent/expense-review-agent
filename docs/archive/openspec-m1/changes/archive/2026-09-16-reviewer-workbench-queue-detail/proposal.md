## Why

後端 M1 API 已經實機驗證，但 `apps/web` 還是 Vite 計數器樣板，初審人員沒有畫面可以使用 Agent 的結果，
M1 Review Copilot 的 demo 因此跑不起來。本 change 交付 Reviewer 工作台最核心的兩個畫面：
**案件總覽**與**案件詳情抽屜**。

服務 **M1 Review Copilot** 的 **M1-U1**（財務初審人員依 Agent 結果完成初審），對應 PRD
**US-1**（案件總覽：統計卡片、篩選、列表）、**US-2**（詳情：申請資訊、逐項檢查、Agent 建議）、
**US-3 AC3.7**（關聯案件）、**US-5**（Reviewer 處置）。

版型與 UX 以 repo 根目錄的 `AI 費用單據初審 Agent.html` 為基礎：頂列、側邊主選單、統計卡片、
篩選 chip、列表，以及右側滑出的詳情抽屜，詳情分成「申請資訊 → 檢查清單 → Agent 建議 → 動作」。
這延續 `bootstrap-m1-foundation` design 定案的 UI 方向。參考檔中凡與定案規則衝突的元素，
本 change 一律依規則修正（見 What Changes）。

另外有一個阻擋前端的 API 缺口：`GET /api/cases` 與 `GET /api/cases/:id` 的 `status` 欄位回傳的是
Agent **分類**，不是案件**流程狀態**。前端因此分不出案件是待審、待補件還是已處置，也無從決定是否
顯示處置按鈕。

## What Changes

**前端（`apps/web`）**

- 以 `AI 費用單據初審 Agent.html` 的版型建立工作台骨架：頂列、側邊主選單。「案件總覽」可用，
  「費用規範」「稽核紀錄」顯示為「即將推出」。
- **案件總覽**：四分類統計卡片、分類篩選 chip（附計數）、案件列表（案件編號、申請人／說明、
  類別、金額、日期、分類徽章、建議、處理狀態）。EXCEPTION 金額標紅（AC1.6）。
  `REVIEW_CLOSED` 參照案件不出現在預設列表。
- **案件詳情抽屜**：申請資訊、Agent 檢查清單（逐項 ✅／❌／⚠️ 加白話理由與證據）、Agent 建議
  （引用規範條文原文）、關聯案件（可點開切換），以及 Reviewer 處置區。
- **Reviewer 處置**：動作按鈕一律由 shared `permittedActions()` 產生，文案依建議類型變化
  （例如 `MANUAL_REVIEW + ACCEPT` 顯示為「轉呈主管」並說明 Reviewer 不下結論）。
  「人工判斷」以 modal 指定最終結論並填寫理由。送出後顯示 API 回傳、已固化的一致性徽章。
- 用 TanStack Query 接 API；回應以 shared Zod schema 驗證。案件開啟狀態寫在網址 hash，可分享、
  可重新整理。
- 參考 HTML 中**不採用**的元素，理由都是違反 CLAUDE.md 定案規則：
  - 「⚠ 退回申請」按鈕：系統沒有「已不通過」終態，最終核准與否屬既有系統職責。
  - 「合併審核／分別通過」「升級副總核准」按鈕：不在合法動作矩陣內。
  - 「📧 發送補件通知」與通知預覽：屬自動處置（M3）。M1 只記錄「退回補件」處置，不寄送任何通知。
  - 前端不渲染 DepChip、信心度、規則五態 tag、§ 條號（bootstrap design 定案）。

**共用（`packages/shared`）**

- 新增 zh-TW 文案表與 `messageKey` + `messageParams` 組字函式。系統訊息、規則理由、狀態、動作
  文案都走這份；DB 仍不存中文。
- 新增工作台呈現邏輯（純函式，前端 import 使用、不重寫一份）：規則結果 → 顯示語氣、
  疑似類規則的措辭保證、依建議產生處置選項與請求內容、金額字串格式化。
- `caseListItemSchema` 與 `caseDetailSchema` 各**新增** `caseStatus` 欄位（加法式，既有欄位不變）。

**後端（`apps/api`）**

- `CasesService.list` / `detail` 在回應中**新增** `caseStatus`，值為案件流程狀態。既有 `status`
  欄位語意不變。

本 change **不新增任何 npm 相依套件**：路由用 hash 自行實作，測試沿用 shared 既有的 `node --test`。
`apps/web` 只新增 workspace 內部相依 `@expense-review-agent/shared`。不涉及 OCR、LLM、Redis、
BullMQ、pgvector，也不改 `schema.prisma`、migration 或 `packages/shared/src/domain/`。

## Capabilities

### New Capabilities

- `reviewer-workbench`：M1-U1 Reviewer 工作台前端，涵蓋案件總覽、案件詳情抽屜與 Reviewer 處置
  互動，以及其顯示端 guardrail（不指控、非通過必示證據、動作只來自 shared 矩陣、徽章不重算、
  i18n 文案）。

### Modified Capabilities

- `review-api`：「案件列表與狀態統計」與「含檢查、建議與規範引用的案件詳情」兩條 requirement
  擴充——回應 MUST 另外帶出案件流程狀態，與 Agent 分類分開。
- `demo-seed`：新增 requirement——R7 的 `REVIEW_CLOSED` 參照案件 MUST 帶完整、前後一致的結案歷程。

## Impact

- **新增**：`apps/web/src/`（app shell、features/queue、features/detail、api client、styles）、
  `packages/shared/src/i18n/`、`packages/shared/src/presentation/` 及其測試、
  `apps/api/src/cases/cases.service.spec.ts`。
- **修改**：`apps/web/package.json`（加入 workspace 相依、`test` script）、`apps/web/vite.config.ts`
  （dev proxy `/api` → `localhost:3000`）、`apps/web/index.html`（標題、語系）、
  `packages/shared/src/api.ts`（新增 `caseStatus`）、`packages/shared/src/index.ts`（匯出）、
  `apps/api/src/cases/cases.service.ts`。
- **移除**：`apps/web` 的 Vite 樣板資產（`App.css`、`assets/*`、計數器 `App.tsx`）。
- **受管路徑**：`apps/api/src/`（@ChichiTung）與 `packages/shared`（只新增，不改 `domain/`）。
  前端 features 目錄 CODEOWNERS 仍為佔位帳號。
- **API 相容性**：純加法，既有呼叫端不受影響。
- **可追溯性／稽核**：不新增稽核欄位。處置一律經既有 `POST /cases/:id/disposition`，
  由後端以 shared 矩陣驗證並在同一 transaction 寫入 hash-chained `AuditEvent`。
  前端只顯示 API 回傳、已固化的 `consistencyFlag`，**不在 UI 端重算徽章**。
- **Seed（`apps/api/prisma/seed/`）**：參照案件 `EXP-2026-1043` 補上完整結案歷程（明細、收據、run、規則結果、
  處置、主管稽核、稽核事件），2002 明細補上相同單號，讓疑似重複的證據點進去有真實內容。
- **Demo 資料影響**：目前 seed 只有 `EXP-2026-2004` 是 `QUEUED`（`2001`、`2002` 是 `DISPOSED`，
  `2003` 是 `AWAITING_INFO`，且都沒有 `Disposition` 列）。依流程狀態控制處置按鈕後，demo 時只有
  一筆案件可以操作。調整 seed 屬 seed owner 範圍，本 change 不處理（見 design Open Questions）。
