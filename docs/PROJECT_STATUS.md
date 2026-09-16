# 專案現況與交接說明（PROJECT STATUS & HANDOFF）

> 對象：專案三位成員。目的：讓每個人**完全理解目前做到哪、還有什麼沒做、 怎麼上手 git 與功能開發、以及分工**。 最後更新：2026-09-16（by @ChichiTung） 搭配閱讀：[ONBOARDING.md](./ONBOARDING.md)（環境建置）、 [GOVERNANCE.md](./GOVERNANCE.md)（權限設定）、 根目錄 [CLAUDE.md](../CLAUDE.md)（不可違反的領域規則）、[AGENTS.md](../AGENTS.md)（開發流程）。

---

## 1. 這個專案是什麼

疊加在既有費用系統之上的 **AI 費用單據初審 Agent**。Agent 讀單據、比對申報與單據、 跑合規規則，把每筆案件分成 **建議通過 / 建議補件 / 建議人工審核** 三桶， **最終決定永遠是人做的**（Agent 不下最終決定）。

- 目前只做 **M1 Review Copilot**（M1-U1 財務初審、M1-U2 主管稽核）。
- **M2（風險情報）、M3（自動處置）不在本階段範圍。** 看到 M2/M3 的東西寫進 `openspec/backlog.md`，不要順手做。

### 技術棧

- 前端：**React + TypeScript + Vite + TanStack Query + Zod**（`apps/web`）
- 後端：**NestJS + TypeScript + Prisma**（`apps/api`）
- 共用：**Zod schema / 型別**（`packages/shared`，前後端共用同一份）
- DB：**PostgreSQL**；物件儲存：S3 / MinIO（本機）
- Monorepo：pnpm workspaces

---

## 2. 目前完成到哪（整體約 65–70%）

地基完成、後端 M1 API 全部實機驗證結案，**初審人員的主畫面（案件總覽 + 詳情抽屜 + 處置）
也已完成並以 headless Chrome 端到端驗證**。誠實的完成度：

| 層                               | 狀態            | 完成度 | 說明                                                                             |
| -------------------------------- | --------------- | ------ | -------------------------------------------------------------------------------- |
| 資料模型 + DB + 治理約束         | ✅ 完成         | ~95%   | schema v3、migration、trigger/CHECK/EXCLUDE 全部套用並實機驗證                   |
| shared 型別契約                  | ✅ 完成         | ~98%   | enum 詞彙、disposition 矩陣、徽章算式、i18n 文案、presentation 純函式            |
| seed 示範資料                    | 🟡 骨架+        | ~55%   | 4 案 + R7 參照案件（含完整結案歷程）+ 明細列，尚未到 10 情境                     |
| **後端 API（讀取類）**           | ✅ 跑通         | ~85%   | summary/list/detail/related/policies/audit 皆驗證；list/detail 已帶 `caseStatus` |
| **後端 API（寫入類）**           | ✅ 跑通         | ~75%   | disposition/supervisor/audit 已驗證；缺狀態機防護（見下）                        |
| **後端審核引擎（規則判定深度）** | 🟡 DEMO 簡化    | ~25%   | run 為 DEMO 判定（沿用 seed 結果）；完整 R1~R10 規則引擎未做（後續 change）      |
| **前端 — 初審工作台**            | ✅ 完成         | ~95%   | 版面骨架、案件總覽、詳情抽屜、Reviewer 處置；39 項 scenario 端到端驗證           |
| **前端 — 稽核頁 / 主管稽核**     | ❌ 未開始       | 0%     | M1-U2 的主體，API 都已就緒，前端完全沒接（見 §2 未開發清單）                     |
| **前端 — 費用規範頁 / 重跑 run** | ❌ 未開始       | 0%     | 側邊選單標「即將推出」；`GET /policies`、`POST /cases/:id/runs` 已可用           |
| **OCR（Phase 2）**               | ❌ 未做（刻意） | 0%     | CLAUDE.md 規定 M1 不做 OCR，用 fixture                                           |
| **串接 LLM API**                 | ❌ 未做         | 0%     | 不在 M1 範圍                                                                     |

### ✅ 已完成的具體內容

- **資料庫**：`docker compose` 起 Postgres/Redis/MinIO；`init_m1_schema_v3` migration 建好所有表/enum/index。
- **治理保證（實機驗證擋下）**：- `AuditEvent`/`Disposition`/`SupervisorReview` append-only（UPDATE/DELETE/TRUNCATE 都被 trigger 擋）。
- 非通過的 `RuleResult`/`MatchResult` 沒掛 `Evidence` → DB 拒絕寫入。
- GATED/ABSTAIN 沒附原因 → 拒絕；Policy 生效區間不重疊（EXCLUDE）。
- **shared 契約**：四分類、三桶建議、五態結果、reviewer/supervisor 動作 enum，全部對齊 Prisma； `disposition.ts` 是唯一的合法動作矩陣，前後端都 import 這份。
- **seed**：`EXP-2026-2001`(NORMAL)、`2002`(EXCEPTION/R7)、`2003`(MISSING/R4)、`2004`(HUMAN/abstain)- `EXP-2026-1043`(R7 參照，REVIEW_CLOSED)。全部含 AuditEvent hash chain。
- **文件與治理**：ONBOARDING、GOVERNANCE、CODEOWNERS（已指到 @ChichiTung）。
- **CI 五關**：`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build` 全綠。
- **後端 API（review-engine-api change）**：`apps/api/src/` 建立 11 支 REST API—— health、cases(summary/list/detail/related)、policies、runs(非同步 202+runId)、 disposition、supervisor-review、audit。讀取類已 curl 驗證通過（四分類統計/篩選正確）。 shared 新增 API 契約型別（`packages/shared/src/api.ts`）；disposition 以 shared 矩陣 驗證、稽核事件於交易內 hash-chain 寫入；shared 轉為 CommonJS 套件（dist build）供 NestJS 執行。
- **前端初審工作台（reviewer-workbench-queue-detail change，2026-09-15）**：
  - `apps/web` 移除 Vite 樣板，建立 `app/AppShell.tsx`（頂列 + 側邊選單）、 `app/router.ts`（hash 路由 `#/cases`、`#/cases/:id`）、`api/client.ts`（Zod parse + `ApiError`） 與 `api/queries.ts`（TanStack Query）。
  - `features/queue/`：四分類統計卡、篩選 chip、八欄案件列表（排除 `REVIEW_CLOSED`）、 載入中／錯誤重試／空狀態。
  - `features/detail/`：案件詳情抽屜（Esc、焦點管理、hash 同步）、檢查清單（✅/❌/⚠️ 與白話理由、 證據片段、關聯案件可點選）、Agent 建議面板（三桶配色 + 規範原文 + 「非最終決定」提示）、 Reviewer 處置（確認視窗、人工判斷視窗、理由必填規則）。
  - **判定相關邏輯全部在 `packages/shared`**：`i18n/zh-TW.ts` + `i18n/format.ts`（永不回傳原始鍵）、 `presentation/check-view.ts`（疑似措辭、證據缺漏標記）、`presentation/disposition-options.ts` （以 `permittedActions` 為唯一來源）、`presentation/money.ts`（字串千分位，不經 `Number`）。 React 元件只負責渲染。徽章一律顯示後端回傳值，不在 UI 重算。
  - seed 的參照案件 `EXP-2026-1043` 補齊完整結案歷程（明細、收據、PASS 規則結果、Reviewer `ACCEPT`、 主管 `APPROVE`、hash-chained 稽核事件）。
  - 以 headless Chrome（CDP 腳本）實際操作驗證 spec 的 39 項 scenario 全數通過。

### ❌ 尚未開發（M1 待做的主體）

依重要性排序：

1. **完整審核引擎（最大缺口）**：目前 `runs.service.ts` 是 DEMO——沿用前一次 run 的分類， **沒有前一次就直接判 `NORMAL` + `HIGH` 信心**。這個預設值本身違反 CLAUDE.md 規則 4 （資料不足不硬判 NORMAL），接真引擎前至少要先改掉。還沒做的：`RuleDefinition` 型錄與 handler 註冊、R1~R10、一致性比對、**雙假設評估**、四分類轉三桶、`inputSnapshot` 寫入。
2. **案件狀態機的防護（前端已用隱藏按鈕擋，後端還沒擋）**：
   - disposition 沒檢查案件是否為 `QUEUED`，已處置的案件仍可再處置一次。
   - supervisor-review 沒檢查狀態，且**主管核可後 `resultingStatus` 是 `null`，案件永遠到不了 `REVIEW_CLOSED`**（`apps/api/src/review/review.service.ts`）。
   - 沒有 `AWAITING_INFO` 補件後回到 `QUEUED` 的 API。
   - 這些是領域行為變更，依 design 的非目標另開 change。
3. **前端稽核頁與主管稽核（M1-U2 的主體）**：`GET /cases/:id/audit`、 `POST /cases/:id/supervisor-review` 都已就緒，前端完全沒接。側邊選單的「稽核紀錄」 目前標「即將推出」。
4. **前端費用規範頁與重跑 run**：`GET /policies`、`POST /cases/:id/runs` + `GET /runs/:runId` 輪詢都可用，前端未實作。
5. **輸入驗證**：沒有 DTO / `ValidationPipe`，送空 body 回 500（應回 400）。
6. **seed 擴充**：從目前 5 筆補到完整 10 情境（含 R1 超額、R5 雙假設、R8 拆單、R10 加總、 R9 統編、未匹配單據、低信心欄位案件）。
7. **死檔清理**：`apps/api/test/app.e2e-spec.ts` 仍是 NestJS 樣板，斷言的 `AppController` 已不存在。

> i18n 文案已於前端 change 完成（`packages/shared/src/i18n/zh-TW.ts`），不再是待辦。

### 🚫 明確不在 M1（別做）

- OCR 擷取（Phase 2）、串接 LLM/影像辨識、Redis/BullMQ/pgvector、自動入帳/付款。

---

## 3. 目前的測試在測什麼（重要澄清）

`pnpm test` 目前 **70 個測試**（`packages/shared` 53 + `apps/api` 17），全是不連 DB 的單元測試：

`packages/shared`（`src/__tests__/`，共 53）：

- **enum-parity（8）**：讀 `schema.prisma` 的 enum，跟 `enums.ts` 的 Zod enum 逐一比對， 確保「資料庫 ↔ 前後端共用型別」100% 一致。任一邊改 enum 沒同步，這關就紅。
- **disposition 矩陣（6）**：測合法動作矩陣（非法動作被拒、`MANUAL_REVIEW+ACCEPT` 會 escalate 等）。
- **consistency-flag（10）**：徽章算式，窮舉 `agentActionAtDecision` × `finalAction` 全部 16 組。
- **check-view（10）**：五種 outcome 的 tone 窮舉、`isSuspicionOnly` 未通過時標題含「疑似」、 非通過且無證據標為 `evidenceMissing`。
- **disposition-options（9）**：三種建議的動作集合與矩陣一致、只有 `MANUAL_JUDGEMENT` 帶 `finalAction`、理由必填與後端規則相同。
- **i18n（5）**：插值、缺鍵回通用句（永不回傳原始鍵）、seed 現有的每個 messageKey 都有文案、 疑似類規則的 FAIL 文案確實是疑似措辭。
- **money（5）**：字串千分位、非 TWD 顯示幣別代碼、`null` 顯示「—」、超出 JS number 範圍不失真。

`apps/api`（jest，手寫 fake Prisma、不連 DB，共 17）：

- **review.service（12）**：處置寫入的 400 路徑（斷言 `$transaction` 未被呼叫）與五種徽章的實際寫入欄位。
- **cases.service（5）**：分類與流程狀態是獨立欄位、無 run 的參照案件 `caseStatus` 為 `REVIEW_CLOSED`、既有 `status` 值不變。

**目前沒有審核引擎的測試、沒有連 DB 的整合測試、`apps/web` 沒有測試框架** —— 審核引擎還沒寫； 前端的判定相關邏輯刻意放在 `packages/shared` 用 `node --test` 測，React 元件只負責渲染， 所以 web 端不另外引入測試套件。前端的行為驗證靠 headless Chrome（CDP 腳本）對照 spec scenario 手動跑。

> `apps/api/test/app.e2e-spec.ts` 仍是 NestJS 樣板且斷言的 `AppController` 已不存在——
> `pnpm test` 掃不到它（jest `rootDir: src`），屬待清理的死檔。

> 執行方式：shared 用 Node 內建 `node --test`（零額外套件）；api 用 jest。

---

## 4. 怎麼上手：Git 與功能開發

### 4.1 第一次進場（照 ONBOARDING.md）

```bash
pnpm install
docker compose up -d
cp .env.example .env
cp .env apps/api/.env          # Prisma 在 apps/api 下執行，需要這份
pnpm --filter api prisma:migrate
pnpm --filter api db:seed
pnpm dev:api    # 一個終端機
pnpm dev:web    # 另一個終端機

```

### 4.2 Git 流程（新手友善版）

1. **永遠從最新 main 開分支**：`git switch main && git pull && git switch -c feat/<你的功能>`
2. **先開 OpenSpec proposal 再寫程式**（非瑣碎改動）：`openspec new change "<change-id>"`， 依序補 proposal → specs → design → tasks（見 AGENTS.md / CLAUDE.md）。
3. **小步 commit**，訊息用 Conventional Commits：`feat: 加入案件佇列 API`、`fix: 修正比對邊界`。
4. **開 PR 前必跑**：`pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build`（全綠才開）。
5. **開 PR** → CODEOWNERS 會自動要求對應 owner 審查 → 審過才能 merge。
6. **不要直推 main**（GOVERNANCE.md 開啟 branch protection 後會被擋）。

### 4.3 CLI 旗標易錯點

- `status` / `instructions` / `new change` 用 `--change`（單數）
- `validate` 用 `--changes`（複數）

### 4.4 哪些檔不要自己動（先問 @ChichiTung）

`schema.prisma`、`prisma/migrations/`、`packages/shared/src/domain/`、`CLAUDE.md`、 `AGENTS.md`、`.claude/`、`CODEOWNERS`、`openspec/config.yaml`。要改先開 issue/proposal。

### 4.5 資料重置

```bash
pnpm --filter api db:reset   # DROP SCHEMA + migrate + seed，回乾淨狀態

```

**不要用 **`TRUNCATE`**/**`DELETE`（append-only 表有 trigger 擋，且 hash chain 需從頭重建）。

---

## 5. 三人建議分工（M1 剩餘工作）

前提：`schema.prisma` 與 `packages/shared/src/domain/` 由 **@ChichiTung**（schema owner）掌關， 任何要改這兩處的需求先提 issue。以下分工讓三人可**平行、低衝突**開發。

### 👤 成員 A — 後端審核引擎（owner: @ChichiTung）

**負責 **`apps/api/src/review/` 與 `apps/api/src/runs/`，是 M1 的核心。

> ✅ **進度（2026-09-16）**：11 支 API 全部實機驗證、讀寫類都跑通、CI 全綠。 剩：規則判定深度與狀態機防護，兩者都還沒開始。

1. **先修 DEMO 的危險預設**：`runs.service.ts` 沒有前一次 run 時直接判 `NORMAL` + `HIGH`， 違反 CLAUDE.md 規則 4，應改為 `HUMAN` 或明確的錯誤。
2. 規則引擎骨架：`RuleDefinition` 型錄載入、handler 註冊、`RuleContext`。
3. 規則 handler：R1 額度、R4 附件、R5 金額一致、R7 重複、R9 統編…（照 `.claude/skills/expense-rule` 一條一條做）。
4. 一致性比對層 + **雙假設評估**（比對不一致時申報值/單據值各跑一次）。
5. 分類與建議產生（四分類 → 三桶）、`inputSnapshot` / `policyVersionId` / `engineVersion` 固化。
6. **狀態機防護**：非 `QUEUED` 不可處置、主管核可推進到 `REVIEW_CLOSED`、`AWAITING_INFO` 補件回 `QUEUED`。
7. 每條規則要有測試（命中/不命中/邊界/資料不足 abstain）。

> 依賴：DB ✅、shared 型別 ✅、API 契約 ✅ 都已就緒，可直接開工。 API 契約只能加欄位不能改（前端已依賴）。

### 👤 成員 B — 前端畫面（owner: 前端 features 目錄）

**負責 **`apps/web/src/features/`，依已定案的 UI/UX 方向：

> **以舊版排版為基底**（側邊主選單 + 案件總覽儀表板 + 檢查清單條列）； v0.3 的 AI 內部判別 tag（DepChip、§條號、信心度、五態）**不進前端**。

> ✅ **進度（2026-09-15）**：版面骨架、`features/queue/`、`features/detail/`、Reviewer 處置 全部完成，39 項 scenario 端到端驗證通過（`reviewer-workbench-queue-detail`）。

剩下的前端工作：

1. `features/audit/`：稽核歷程頁（見成員 C）。
2. **主管稽核操作**：核可 / 提出疑慮（必填意見）／退回初審，接 `POST /cases/:id/supervisor-review`。 需要先決定 Reviewer 與主管視角怎麼切換（M1 無認證，後端是固定 demo actor）。
3. **費用規範頁**：接 `GET /policies`，顯示組織 Policy 條文原文與版本。
4. **重跑 Agent run**：`POST /cases/:id/runs` → 輪詢 `GET /runs/:runId`。
5. **補件流程 UI**：`AWAITING_INFO` 案件補件後重新送審（需等後端先補 API）。

> 規矩：判定相關邏輯一律放 `packages/shared`（`i18n/`、`presentation/`）用 `node --test` 測， React 元件只渲染。徽章顯示後端回傳值，不得在 UI 重算。 明確非目標：暗色主題、行動版版面、登入。

### 👤 成員 C — Seed 擴充 + i18n + 稽核頁 + 整合驗證

**跨接的黏合工作，適合先熟悉全貌的人：**

1. **seed 擴充**：把目前 5 案補到完整 10 情境（照 `.claude/skills/demo-case`）， 含 R1 超額、R5 雙假設、R8 拆單、R10 加總、R9 統編、低信心欄位、未匹配單據等（tasks §4.2/4.4/4.5）。 新增情境時要順手補 `i18n/zh-TW.ts`，i18n 測試會檢查每個 messageKey 都有文案。
2. `features/audit/`：稽核頁（唯讀歷程、hash chain 驗證結果、導出），接已就緒的 `GET /cases/:id/audit`。
3. **整合驗證**：`db:reset` 兩次一致性、app 端到端跑通（tasks §6.2）、hash chain 竄改偵測測試（§2.3）。
4. **死檔清理**：移除或改寫 `apps/api/test/app.e2e-spec.ts`。

> i18n 文案的骨架已於前端 change 完成（`packages/shared/src/i18n/zh-TW.ts` + `i18n/format.ts`）， 這條線現在是「隨 seed 情境補文案」，不是從零開始。

> 這條線最適合當「第一個練習任務」——seed 擴充是機械式、有 skill 可循，能快速熟悉資料模型。

### 分工重疊風險與建議

- A 與 B 的交界是 **API 契約**：建議 A 先把 `POST /cases/:id/runs` 與案件查詢的 **回傳型別**放進 `packages/shared`（先問 owner），B 就能照型別開發、不必等 API 實作完。
- 三人都會碰 `packages/shared`：**新增型別可以，改既有 enum/矩陣要先問 @ChichiTung**。

---

## 6. 待辦追蹤

**進行中的 change：**

### `bootstrap-m1-foundation`（地基）— 17/22 完成

剩：`2.3` hash chain 竄改測試、`4.2` seed 擴充到 10 情境、`4.4` 低信心欄位案件、 `4.5` db:reset 兩次一致性、`6.2` app 端到端驗證。

### `reviewer-workbench-queue-detail`（前端初審工作台）— 37/37 完成，**待 archive**

- shared 的 i18n 與 presentation 模組、後端 `caseStatus` 欄位、前端骨架／總覽／詳情抽屜／處置 全部完成，參照案件 `EXP-2026-1043` 補齊完整結案歷程。
- CI 五關全綠；以 headless Chrome（CDP 腳本）驗證 spec 的 39 項 scenario 全數通過， 並實際送出一次處置、確認 `GET /api/cases/:id/audit` 新增 `REVIEWER_DISPOSITION` 事件且 `chainValid: true`。
- 下一步：schema owner 執行 `openspec-sync-specs` 與 `openspec-archive-change`。

**已 archive 的 change：**

- `2026-09-10-review-engine-api`（後端 11 支 API）
- `2026-09-10-fix-disposition-consistency-flag`（徽章算式移入 `packages/shared`、新增 `PENDING_DECISION`、 補上 shared 與 api 兩層測試；修正 `finalAction` 被寫成 Agent 建議複本的缺陷）

完整清單見各自的 `openspec/changes/<id>/tasks.md`；已 archive 的在 `openspec/changes/archive/`。

### 建議的下一個 change

1. **後端狀態機防護**（處置前置條件、主管核可後結案、`AWAITING_INFO` 補件回 `QUEUED`）—— 工作量小，且目前的缺口會讓 demo 流程走不完。
2. **前端稽核頁 + 主管稽核**—— API 都已就緒，能讓 M1-U2 真正可展示。
3. **seed 擴充到 10 情境**—— 當作規則引擎的驗收資料，機械式、有 skill 可循，適合當練習任務。
4. **完整規則引擎**—— 工作量最大，建議在 seed 情境齊備後再開。

### monorepo 開發節奏提醒（本次學到）

- **改了 `packages/shared` 一定要 **`pnpm --filter shared build`，否則 api（吃 dist）拿到舊版。
- **後端 tsconfig 用 `module: CommonJS` + **`moduleResolution: Node`（NestJS 執行期需求）。
- `tsc --noEmit`** 過 ≠ 跑得起來**，真正驗證要 `pnpm dev:api` 實際執行。
