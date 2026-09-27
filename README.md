# CheckMate

> **AI Expense Review & Control Agent for corporate expense review.**

CheckMate 是企業費用審查中的代理式（Agentic）服務，協助完成大量重複性的初步檢查、辨識風險與整理判斷依據，
並在企業授權與控制機制下執行可安全自動化的處置，讓財務人員專注在真正需要專業判斷的案件。

<p>
  <img alt="stack" src="https://img.shields.io/badge/stack-React_%7C_NestJS_%7C_Prisma_%7C_PostgreSQL-3E4F58">
  <img alt="workflow" src="https://img.shields.io/badge/workflow-Spec_%2B_TDD-8F5E12">
  <img alt="status" src="https://img.shields.io/badge/status-refactoring_to_CheckMate_PRD-B03A2E">
</p>

> **重構進行中**：本 Repo 原為 expense-review-agent（M1 Review Copilot），
> 正在 `refactor` 分支依 CheckMate PRD 分階段重建。進度見 [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md)。

---

## 壹、核心亮點

1. **代理式審查**：不只判斷「建議通過／建議補件／建議人工審核」，也能在授權範圍內接手後續例行工作，
   例如通知補件、轉交人工、推進流程與留下處理紀錄。
2. **找出規則之外的風險**：除了企業規範與欄位比對，也辨識合理性、憑證真偽風險、歷史異常、
   重複申報／疑似拆單與跨系統風險訊號。
3. **用決策資料持續改善制度**：保留每次 Agent 判斷、人工覆寫、最終處置與結果，作為檢視規範、流程與自動化邊界的依據。
4. **低門檻快速導入**：疊加在既有 ERP、BPM、費用管理或會計流程之上，不必先汰換原有系統。

## 貳、如何運作

```text
費用申請／單據
→ 擷取與整理資料
→ 比對申請與憑證
→ 檢查企業規範／法規
→ 辨識異常與風險
→ 產生審查建議
→ 自動處置或轉人工
→ 留下完整決策紀錄
```

審查建議只有三種：**建議通過**、**建議補件**、**建議人工審核**。
審查建議與實際流程動作（PROCEED／REQUEST_INFO／ESCALATE）分開；只有在符合控制條件與企業授權時，Agent 才能自動執行。

## 參、如何控制 AI 自動化風險

```text
必要檢查完成
＋ 證據充分
＋ 規則結果明確
＋ 無阻擋風險
＋ 無未解決衝突
＋ 位於企業授權範圍
＝ 才能自動執行
```

資料不足、規則衝突、高風險或超出授權範圍時，案件一律轉為補件或人工處理；所有 Agent 與人工決策皆保留可追溯紀錄。

工程層的對應保證：

| 保證                 | 做法                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------- |
| 每個發現項目都有佐證 | 非通過的發現項目沒有佐證資料，資料庫直接拒絕寫入（DB CHECK 約束）                      |
| 紀錄不可竄改         | 稽核與流程動作紀錄只能新增，並以 hash chain 串接；UPDATE／DELETE 由資料庫 trigger 擋下 |
| 判定可回放           | 每次審查記錄當下的規範版本、引擎版本與輸入快照                                         |
| 前後端同一份規則     | 審查引擎、建議推導與自動執行條件集中在 `packages/shared`                               |

## 肆、產品邊界

CheckMate 聚焦於**費用初審、風險辨識與受控處置**，不是完整的費用管理系統。
不執行最終核准、正式會計入帳、自動付款、正式稅務申報、最終稅務認定，以及舞弊或偽造的最終法律判定。
所有示範與測試資料皆為模擬資料。

---

## 伍、技術棧

| 層       | 技術                                                         |
| -------- | ------------------------------------------------------------ |
| 前端     | React + TypeScript + Vite、TanStack Query、Zod（`apps/web`） |
| 後端     | NestJS + TypeScript、Prisma ORM（`apps/api`）                |
| 共用     | Zod schema、型別與領域邏輯（`packages/shared`）              |
| 資料庫   | PostgreSQL                                                   |
| Monorepo | pnpm workspaces                                              |
| 開發流程 | Spec + Acceptance Criteria → Test-first → Implementation     |

## 陸、專案結構

```
.
├── apps/
│   ├── api/        # 後端 NestJS：prisma/（schema + migrations + seed）、src/（API）
│   └── web/        # 前端 React
├── packages/
│   └── shared/     # 前後端共用的型別與領域邏輯
├── docs/
│   ├── product/    # CheckMate 產品文件（命題、Brief、Scope、User Flow、Edge Cases）
│   ├── design/     # Design System 與 Interaction Patterns
│   └── archive/    # 舊版文件（M1 Review Copilot、OpenSpec 紀錄）
├── specs/          # 已收斂的 User Story / Feature 行為規格
├── CLAUDE.md       # AI 協作與不可違反的規則
└── AGENTS.md       # 開發流程與慣例（人與 AI agent 皆適用）
```

## 柒、快速開始

**需求**：Node.js ≥ 22、pnpm 11.x、Docker Desktop。

```bash
pnpm install
docker compose up -d                 # 本機 Postgres
cp .env.example .env
cp .env apps/api/.env                # Prisma 在 apps/api 下執行
pnpm --filter api prisma:migrate     # 建立資料庫結構
pnpm --filter api db:seed            # 灌入示範案件
pnpm dev:api                         # 後端（一個終端機）
pnpm dev:web                         # 前端（另一個終端機）
```

第一次上手的完整說明見 [docs/ONBOARDING.md](./docs/ONBOARDING.md)。

## 捌、開發流程

已收斂的產品行為先寫進 `specs/`，再把 Acceptance Criteria 轉成測試、最後實作。
詳見 [AGENTS.md](./AGENTS.md) 與 [CLAUDE.md](./CLAUDE.md)。

開 PR 前必跑（CI 也會跑，且為 merge 必要條件）：

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

## 玖、文件

| 文件                                               | 用途                                                 |
| -------------------------------------------------- | ---------------------------------------------------- |
| `docs/product/original-challenge.md`               | 原始命題、限制與最低交付要求                         |
| `docs/product/product-discovery.md`                | 市場證據、問題理解與產品假設                         |
| `docs/product/product-brief.md`                    | 定案的產品方向、核心價值與產品原則                   |
| `docs/product/product-scope.md`                    | 本次版本的範圍、優先級與邊界                         |
| `docs/product/user-flow.md`                        | 全局產品流程骨架與待決問題                           |
| `docs/product/edge-cases.md`                       | 已知關鍵情境                                         |
| `docs/product/prd-review-criteria.md`              | 撰寫 Spec 與 Acceptance Criteria 的檢查基準          |
| `docs/design/design-system.md`                     | 視覺、元件與 UX Writing 原則                         |
| `docs/design/interaction-patterns.md`              | 共用操作流程與互動規則                               |
| `specs/`                                           | 已收斂 User Story / Feature 的行為規格與驗收條件     |
| [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md) | 重構進度與各階段範圍                                 |
| [docs/API_SPEC.md](./docs/API_SPEC.md)             | 後端 API 規格（舊版 v3，階段四替換）                 |
| [docs/ONBOARDING.md](./docs/ONBOARDING.md)         | 新成員從 clone 到跑起來的完整步驟                    |
| [docs/GOVERNANCE.md](./docs/GOVERNANCE.md)         | GitHub 權限設定（CODEOWNERS、branch protection、CI） |

---

<sub>CheckMate｜2026 AI Practitioner Program・第 5 組</sub>
