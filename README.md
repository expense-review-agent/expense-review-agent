# expense-review-agent — AI 費用單據初審 Agent

> **讓認真的人，把時間花在對的地方。**
> 在既有費用系統之上疊一層 **AI Review Layer**，把財務團隊從「逐件人工審核」
> 帶向「以風險與例外為主的審查模式」。Agent 提出建議，**人做最終決定**。

<p>
  <img alt="milestone" src="https://img.shields.io/badge/milestone-M1_Review_Copilot-0B6E4F">
  <img alt="stack" src="https://img.shields.io/badge/stack-React_%7C_NestJS_%7C_Prisma_%7C_PostgreSQL-3E4F58">
  <img alt="workflow" src="https://img.shields.io/badge/workflow-Spec_Driven_(OpenSpec)-8F5E12">
  <img alt="status" src="https://img.shields.io/badge/status-DEMO_in_progress-B03A2E">
</p>

---

## 這個專案在解決什麼問題

財務初審人員今天是「逐件完整審核」——不論案件風險高低都投入相近時間，導致：

- **注意力錯配**：~65% 的正常案件消耗大部分審核時間，真正該判斷的案件被擠到疲勞時段。
- **風險盲區**：人工抽審僅覆蓋 ~15% 的報告，其餘未被檢查。
- **一致性漂移**：同一條規範，不同人、不同時段判斷不一，難以稽核。

**我們的解法不是「讓人審得更快」，而是「讓人只審該審的」。**
Agent 自動讀單據、比對申報與單據、跑合規規則，把每筆案件分成三桶建議：
**✅ 建議通過｜📎 建議補件｜👤 建議人工審核**，讓低風險案件快速放行、高風險案件浮上檯面。

---

## 產品特點（Why this is different）

| 特點                          | 說明                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 🧭 **Agent 提建議，人做決定** | Agent 只做讀取/擷取/比對/檢查/分類/解釋，**絕不下最終決定**（不入帳、不付款、不認定發票合法性）。責任邊界寫死在領域規則裡。 |
| 🔍 **每個判定都可追溯**       | 每筆結論都附**證據**、**規範引用**、**判斷理由**。非通過的結論沒有證據，資料庫直接拒絕寫入（DB CHECK 約束）。               |
| 🔒 **稽核紀錄不可竄改**       | 處置、主管稽核、稽核事件皆 **append-only**，並以 **hash chain** 串接。連系統管理員想刪都被資料庫 trigger 擋下。             |
| ⏮️ **判定可回放**             | 每次審核記錄當下的 Policy 版本、引擎版本與輸入快照——舊案件不會被新版規範回溯評斷。                                          |
| 🚦 **四狀態分流**             | `NORMAL / MISSING / EXCEPTION / HUMAN` 四種狀態，各有明確的視覺區分與 Agent 行為。資料不足或低信心**絕不硬判通過**。        |
| 🧩 **前後端共用契約**         | 判定詞彙與「合法動作矩陣」集中在 `packages/shared`，前後端引用同一份，杜絕定義漂移。                                        |

---

## 里程碑

```
M1 Review Copilot   →   M2 Risk Intelligence   →   M3 Autonomous Review
（今天 → Demo Day）        （下一階段）                 （長期願景）
Agent 審查+建議           Agent 比對業務情境           企業設定授權邊界
人類確認+執行             人類負責最終判斷             Agent 自動執行+人類監控
```

**目前聚焦 M1**（M1-U1 財務初審、M1-U2 主管稽核）。M2/M3 不在本階段範圍，
相關想法記錄在 [`openspec/backlog.md`](./openspec/backlog.md)。

---

## 技術棧

| 層       | 技術                                                         |
| -------- | ------------------------------------------------------------ |
| 前端     | React + TypeScript + Vite、TanStack Query、Zod（`apps/web`） |
| 後端     | NestJS + TypeScript、Prisma ORM（`apps/api`）                |
| 共用     | Zod schema / 型別 / 合法動作矩陣（`packages/shared`）        |
| 資料庫   | PostgreSQL（M2 用 pgvector 做語意檢索）                      |
| 物件儲存 | S3 / MinIO（本機開發用，M1 尚未使用）                        |
| Monorepo | pnpm workspaces                                              |
| 開發流程 | OpenSpec（Spec-Driven Development）                          |

> 註：Redis / BullMQ / pgvector 為 M2/M3 所需，M1 不引入。

---

## 專案結構

```
expense-review-agent/
├── apps/
│   ├── api/        # 後端 NestJS：prisma/（schema + migrations + seed）、src/review/（API）
│   └── web/        # 前端 React：features/（queue / detail / audit）
├── packages/
│   └── shared/     # 前後端共用 Zod enum、型別、disposition 合法動作矩陣
├── openspec/       # Spec-Driven 開發的規格與變更提案；backlog.md 記錄延後項目
├── docs/           # 專案文件（見下方「文件」）
├── docker-compose.yml   # 本機 Postgres + Redis + MinIO
├── CLAUDE.md       # 不可違反的領域規則（責任邊界、稽核、規範引擎）
└── AGENTS.md       # 開發流程與慣例（人與 AI agent 皆適用）
```

---

## 快速開始

**需求**：Node.js ≥ 22、pnpm 11.x、Docker Desktop。

```bash
# 1) 安裝相依
pnpm install

# 2) 啟動本機基礎設施（Postgres + Redis + MinIO）
docker compose up -d

# 3) 建立環境變數（根目錄 + apps/api 各一份給 Prisma）
cp .env.example .env
cp .env apps/api/.env

# 4) 建立資料庫結構（套用 migration）
pnpm --filter api prisma:migrate

# 5) 灌入示範案件
pnpm --filter api db:seed

# 6) 啟動前後端（各開一個終端機）
pnpm dev:api
pnpm dev:web
```

想直接看資料庫內容？`cd apps/api && pnpm exec prisma studio`（瀏覽器開 `localhost:5555`）。

第一次上手的完整說明見 [docs/ONBOARDING.md](./docs/ONBOARDING.md)。

---

## 開發流程：Spec-Driven Development

本 repo 用 [OpenSpec](https://github.com/Fission-AI/OpenSpec)——**任何非瑣碎的改動，
先寫規格（proposal → specs → design → tasks）再寫程式**。這讓多人 + 多個 AI agent
同時開發時不會互相衝突。

```bash
openspec new change "<change-id>"                     # 開一個變更
openspec instructions proposal --change "<id>" --json # 依序補齊各 artifact
openspec validate --changes "<id>" --json             # 驗證（注意 validate 用 --changes 複數）
```

**開 PR 前必跑四關**（CI 也會跑，且為 merge 必要條件）：

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Commit 訊息遵循 [Conventional Commits](https://www.conventionalcommits.org/)。
完整慣例見 [AGENTS.md](./AGENTS.md)。

---

## 文件

| 文件                                               | 內容                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| [docs/PROJECT_STATUS.md](./docs/PROJECT_STATUS.md) | 當前進度、已完成 vs 未開發、測試說明、三人分工                       |
| [docs/API_SPEC.md](./docs/API_SPEC.md)             | 後端 M1 API 規格（對應 PRD US-1~US-5）                               |
| [docs/ONBOARDING.md](./docs/ONBOARDING.md)         | 新成員從 clone 到跑起來的完整步驟                                    |
| [docs/GOVERNANCE.md](./docs/GOVERNANCE.md)         | GitHub 權限設定（CODEOWNERS、branch protection、CI required checks） |
| [CLAUDE.md](./CLAUDE.md)                           | 不可違反的領域規則（責任邊界、稽核、規範引擎）                       |
| [AGENTS.md](./AGENTS.md)                           | 開發流程與慣例（人與 AI 皆適用）                                     |

---

## 授權與倫理

- 所有示範資料皆為**模擬資料**，不含任何真實發票號碼、個資或供應商帳務文件。
- 本系統**不**執行正式稅務申報、會計入帳或自動付款；疑似高風險案件一律轉交人工。
- Agent 僅執行初步檢查與風險提示，**不取代人工最終決策**。

---

<sub>Made by 第 5 組 ｜ 職游 NaviCareer × AWS × 伊雲谷 AI 職涯實戰營</sub>
