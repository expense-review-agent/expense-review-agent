## Why

`bootstrap-m1-foundation` 已交付資料庫、治理約束、shared 領域契約與 seed，
但**後端 API 尚未存在**（`apps/api/src` 仍是 NestJS 樣板）。前端（案件佇列／詳情頁）
沒有可呼叫的 API，M1 Review Copilot 的 demo 無法端到端跑通。

本 change 新增 **M1 review-engine 後端 API**，服務 `PRD v0.1` 定義的 Reviewer 工作台
（US-1~US-5）與 `Product Vision & Strategy` 的可追溯性要求，對應 **M1-U1**（初審人員依
Agent 結果完成初審）與 **M1-U2**（主管可追溯稽核）。

**範圍定調 — DEMO 導向：** 目標是 Demo Day，不是落地上線。判定邏輯可簡化（讀 seed 已算好的
run 結果，或用小型規則映射），只要 API 契約正確、前端能驅動完整流程即可。完整規則引擎深度
（每條 R1~R10 handler、詳盡測試）明確不在本 change 範圍。

## What Changes

- 新增驅動 Reviewer 工作台的讀取 API：
  - `GET /api/health`
  - `GET /api/cases/summary` — 四狀態計數（US-1 統計卡片）
  - `GET /api/cases?status=` — 案件列表（可選 status 篩選）（US-1）
  - `GET /api/cases/:id` — 單案完整詳情：申請資訊、擷取資料、逐項檢查結果、
    Agent 建議、規範引用（US-2）
  - `GET /api/cases/:id/related` — HUMAN／重複案件的關聯案件（US-3）
  - `GET /api/cases/:id/audit` — append-only 稽核軌跡與 hash chain 驗證（Vision 5.1）
  - `GET /api/policies?category=` — 8 條費用規範（US-4）
- 新增非同步 Agent run 契約：
  - `POST /api/cases/:id/runs` — 回 **202 + runId**（依 CLAUDE.md 設計為非同步，
    使 Phase-2 OCR 只需替換 runner、不改契約）
  - `GET /api/runs/:runId` — 供前端輪詢的 run 狀態
- 新增人工動作寫入 API（M1-U1／M1-U2）：
  - `POST /api/cases/:id/disposition` — Reviewer 處置，以 shared disposition 矩陣驗證；
    寫入 append-only `Disposition` + `AuditEvent`
  - `POST /api/cases/:id/supervisor-review` — 主管稽核動作；寫入 append-only
    `SupervisorReview` + `AuditEvent`
- 於 `apps/api/src/review/` 下新增 NestJS 模組（cases、policies、runs、
  common/prisma、health），遵循既有模組邊界。
- 將 API 回應／請求型別加入 `packages/shared`，讓前端可依契約平行開發。

本 change **不引入任何新的執行期相依**，也**不**加入 OCR、LLM、Redis 或 pgvector
（皆留在 `openspec/backlog.md`）。

## Capabilities

### New Capabilities

- `review-api`: M1 後端 HTTP API 介面 — 案件查詢、規範列表、非同步 Agent run、
  Reviewer／主管動作、稽核軌跡取得 — 讓 Reviewer 工作台能端到端運作，同時保持每個決定
  可追溯、每個 Reviewer 動作都經 shared 合法動作矩陣驗證。

### Modified Capabilities

<!-- 無。bootstrap-m1-foundation 的 data-model / shared-domain / demo-seed 這三個
     capability 是被「使用」而非「變更」，其 requirement 不受本 change 影響。 -->

## Impact

- **新增**：`apps/api/src/review/`（controllers、services、modules）、
  少量 `apps/api/src/**/*.spec.ts`（DEMO 級最小集）、`packages/shared` 的新請求／回應型別。
- **修改**：`apps/api/src/app.module.ts`（接入新模組）。
- **動到的受管路徑**（依 `.github/CODEOWNERS`）：`apps/api/src/review/`（@ChichiTung）
  與 `packages/shared`（新增型別；`packages/shared/src/domain/` 的 disposition 矩陣為
  **使用而非修改**——若需改動屬另一個 schema-owner 決策）。
- **可追溯性／稽核影響**：每次 `disposition` 與 `supervisor-review` 寫入都必須在同一
  transaction 內附帶一筆 hash-chained `AuditEvent`。Reviewer 動作必須以 shared 矩陣的
  `resolveDisposition()` 驗證；非法動作回 400，而非讓它進到 DB。本 change 不新增稽核欄位
  ——而是實地運用 schema v3 既有的可追溯性保證。
- **API 設計約束**：`POST /cases/:id/runs` 為非同步（202 + runId），即使 M1 是同步運算，
  如此 Phase-2 OCR 僅需替換 runner。
