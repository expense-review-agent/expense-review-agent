# 專案現況與交接說明（PROJECT STATUS & HANDOFF）

> 對象：專案三位成員。目的：讓每個人**完全理解目前做到哪、還有什麼沒做、 怎麼上手 git 與功能開發、以及分工**。 最後更新：2026-09-09（by @ChichiTung）
> 搭配閱讀：[ONBOARDING.md](./ONBOARDING.md)（環境建置）、 [GOVERNANCE.md](./GOVERNANCE.md)（權限設定）、 根目錄 [CLAUDE.md](../CLAUDE.md)（不可違反的領域規則）、[AGENTS.md](../AGENTS.md)（開發流程）。

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

## 2. 目前完成到哪（整體約 40–45%）

地基完成，且**後端 API 骨架已跑通**。誠實的完成度：

| 層                               | 狀態            | 完成度 | 說明                                                                      |
| -------------------------------- | --------------- | ------ | ------------------------------------------------------------------------- |
| 資料模型 + DB + 治理約束         | ✅ 完成         | ~95%   | schema v3、migration、trigger/CHECK/EXCLUDE 全部套用並實機驗證            |
| shared 型別契約                  | ✅ 完成         | ~95%   | enum 詞彙、disposition 矩陣、parity/matrix 測試、API 契約型別             |
| seed 示範資料                    | 🟡 骨架+        | ~45%   | 4 案 + R7 參照 + 明細列(ExpenseLine) + currentRunId，尚未到 10 情境       |
| **後端 API（讀取類）**           | ✅ 跑通         | ~80%   | 案件 summary/list/detail/related、policies 皆 curl 驗證通過               |
| **後端 API（寫入類）**           | 🟡 已寫未測     | ~60%   | disposition/supervisor/audit 程式已寫、四關綠，但尚未 curl 驗證           |
| **後端審核引擎（規則判定深度）** | 🟡 DEMO 簡化    | ~25%   | run 為 DEMO 判定（讀 seed 結果）；完整 R1~R10 規則引擎未做（後續 change） |
| **前端所有畫面**                 | ❌ 未開始       | ~2%    | `apps/web` 還是 Vite 計數器樣板                                           |
| **OCR（Phase 2）**               | ❌ 未做（刻意） | 0%     | CLAUDE.md 規定 M1 不做 OCR，用 fixture                                    |
| **串接 LLM API**                 | ❌ 未做         | 0%     | 不在 M1 範圍                                                              |

### ✅ 已完成的具體內容

- **資料庫**：`docker compose` 起 Postgres/Redis/MinIO；`init_m1_schema_v3` migration 建好所有表/enum/index。
- **治理保證（實機驗證擋下）**：- `AuditEvent`/`Disposition`/`SupervisorReview` append-only（UPDATE/DELETE/TRUNCATE 都被 trigger 擋）。
- 非通過的 `RuleResult`/`MatchResult` 沒掛 `Evidence` → DB 拒絕寫入。
- GATED/ABSTAIN 沒附原因 → 拒絕；Policy 生效區間不重疊（EXCLUDE）。
- **shared 契約**：四分類、三桶建議、五態結果、reviewer/supervisor 動作 enum，全部對齊 Prisma； `disposition.ts` 是唯一的合法動作矩陣，前後端都 import 這份。
- **seed**：`EXP-2026-2001`(NORMAL)、`2002`(EXCEPTION/R7)、`2003`(MISSING/R4)、`2004`(HUMAN/abstain)- `EXP-2026-1043`(R7 參照，REVIEW_CLOSED)。全部含 AuditEvent hash chain。
- **文件與治理**：ONBOARDING、GOVERNANCE、CODEOWNERS（已指到 @ChichiTung）。
- **CI 四關**：`pnpm lint && pnpm typecheck && pnpm test && pnpm build` 全綠。
- **後端 API（review-engine-api change）**：`apps/api/src/` 建立 11 支 REST API—— health、cases(summary/list/detail/related)、policies、runs(非同步 202+runId)、 disposition、supervisor-review、audit。讀取類已 curl 驗證通過（四分類統計/篩選正確）。 shared 新增 API 契約型別（`packages/shared/src/api.ts`）；disposition 以 shared 矩陣 驗證、稽核事件於交易內 hash-chain 寫入；shared 轉為 CommonJS 套件（dist build）供 NestJS 執行。

### ❌ 尚未開發（M1 待做的主體）

- **後端寫入類 API 實測**：disposition/supervisor/audit 程式已寫、四關綠， 但尚未實際 curl 驗證（append-only + hash chain + 矩陣驗證的實機行為）。
- **完整審核引擎**：目前 run 是 DEMO 簡化判定（讀 seed 結果）；完整規則 handler （R1~R10）、一致性比對、雙假設評估屬後續 change，DEMO 不一定需要。
- **前端畫面**：案件總覽儀表板 + 側邊主選單、案件詳情（檢查清單條列）、稽核頁。
- **seed 擴充**：從 4 案補到完整 10 情境（含低信心欄位案件）。
- **i18n 文案**：`messageKey` 對應的中文組字。

### 🚫 明確不在 M1（別做）

- OCR 擷取（Phase 2）、串接 LLM/影像辨識、Redis/BullMQ/pgvector、自動入帳/付款。

---

## 3. 目前的測試在測什麼（重要澄清）

`pnpm test` 目前 **14 個測試全在 **`packages/shared`，是**純邏輯單元測試**：

- **enum-parity（8）**：讀 `schema.prisma` 的 enum，跟 `enums.ts` 的 Zod enum 逐一比對， 確保「資料庫 ↔ 前後端共用型別」100% 一致。任一邊改 enum 沒同步，這關就紅。
- **disposition（6）**：測合法動作矩陣（非法動作被拒、`MANUAL_REVIEW+ACCEPT` 會 escalate 等）。

**目前沒有審核引擎的測試、沒有 mock 案件資料在測試裡、沒有連 DB 的整合測試** —— 因為審核引擎還沒寫。 `apps/api` 的 `app.controller.spec.ts` 只是 NestJS 樣板（"Hello World"），非業務邏輯。

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
4. **開 PR 前必跑**：`pnpm lint && pnpm typecheck && pnpm test && pnpm build`（四關要綠）。
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

**負責 **`apps/api/src/review/`，是 M1 的核心。

> ✅ **進度（2026-09-09）**：11 支 API 骨架已完成、讀取類跑通、四關綠。 剩：寫入類 API 實測、規則判定深度（DEMO 可用簡化版）。

1. 規則引擎骨架：`RuleDefinition` 型錄載入、handler 註冊、`RuleContext`。
2. 規則 handler：R1 額度、R4 附件、R5 金額一致、R7 重複、R9 統編…（照 `.claude/skills/expense-rule` 一條一條做）。
3. 一致性比對層 + **雙假設評估**（比對不一致時申報值/單據值各跑一次）。
4. 分類與建議產生（四分類 → 三桶）、`POST /cases/:id/runs`（非同步、回 202+runId、前端輪詢）。
5. 每條規則要有測試（命中/不命中/邊界/資料不足 abstain）。

> 依賴：DB ✅、shared 型別 ✅ 都已就緒，可直接開工。

### 👤 成員 B — 前端畫面（owner: 前端 features 目錄）

**負責 **`apps/web/src/features/`，依已定案的 UI/UX 方向：

> **以舊版排版為基底**（側邊主選單 + 案件總覽儀表板 + 檢查清單條列）； v0.3 的 AI 內部判別 tag（DepChip、§條號、信心度、五態）**不進前端**。

1. 版面骨架：側邊主選單 + 路由（案件總覽 / 詳情 / 稽核）。
2. `features/queue/`：案件總覽儀表板（四分類統計 + 清單）。
3. `features/detail/`：案件詳情（檢查清單條列 + 三桶建議 + 處置按鈕）。
4. 用 **TanStack Query** 接後端 API（先用 mock/seed 資料對接），型別一律 import `packages/shared`。

> 依賴：可先用 seed 資料與假 API 平行開發，API 好了再對接。

### 👤 成員 C — Seed 擴充 + i18n + 稽核頁 + 整合驗證

**跨接的黏合工作，適合先熟悉全貌的人：**

1. **seed 擴充**：把骨架 4 案補到完整 10 情境（照 `.claude/skills/demo-case`）， 含 R8 拆單、R10 加總、低信心欄位、未匹配單據等（tasks §4.2/4.4/4.5）。
2. **i18n 文案**：`packages/shared/src/i18n/zh-TW.ts`，把 `messageKey` 補成中文組字。
3. `features/audit/`：稽核頁（唯讀歷程、hash chain 驗證、導出）。
4. **整合驗證**：`db:reset` 兩次一致性、app 端到端跑通（tasks §6.2）、hash chain 竄改偵測測試（§2.3）。

> 這條線最適合當「第一個練習任務」——seed 擴充是機械式、有 skill 可循，能快速熟悉資料模型。

### 分工重疊風險與建議

- A 與 B 的交界是 **API 契約**：建議 A 先把 `POST /cases/:id/runs` 與案件查詢的 **回傳型別**放進 `packages/shared`（先問 owner），B 就能照型別開發、不必等 API 實作完。
- 三人都會碰 `packages/shared`：**新增型別可以，改既有 enum/矩陣要先問 @ChichiTung**。

---

## 6. 待辦追蹤

**兩個 OpenSpec change 的進度：**

### `bootstrap-m1-foundation`（地基）— 17/22 完成

剩：`2.3` hash chain 竄改測試、`4.2` seed 擴充到 10 情境、`4.4` 低信心欄位案件、 `4.5` db:reset 兩次一致性、`6.2` app 端到端驗證。

### `review-engine-api`（後端 API）— 13/20 完成

- ✅ 已完成：shared 型別、Prisma+health、cases、policies、runs、四關 CI。
- 🟡 剩：`5.1~5.5` 寫入類 API 實測（disposition/supervisor/audit）、 `6.2` 端到端寫入流程、`7.1`（選用）hash helper 抽到 shared。

完整清單見各自的 `openspec/changes/<id>/tasks.md`。

### monorepo 開發節奏提醒（本次學到）

- **改了 **`packages/shared`** 一定要 **`pnpm --filter shared build`，否則 api（吃 dist）拿到舊版。
- **後端 tsconfig 用 **`module: CommonJS`** + **`moduleResolution: Node`（NestJS 執行期需求）。
- `tsc --noEmit`** 過 ≠ 跑得起來**，真正驗證要 `pnpm dev:api` 實際執行。
