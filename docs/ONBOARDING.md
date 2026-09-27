# 組員上手指南（Contributor Onboarding）

> 目標：**沒有相關開發經驗的組員，照這份文件由上到下跑一遍，就能把 app 跑起來
> 並進入功能開發。**
>
> 前端技術棧為 **React + TypeScript + Vite + TanStack Query**（團隊已決定）。

---

## 0. 這個專案在做什麼（30 秒版）

**CheckMate** 是疊加在既有費用系統之上的 AI Expense Review & Control Agent：
Agent 讀單據、比對、檢查規範與風險，產生「建議通過 / 建議補件 / 建議人工審核」，
並在自動執行條件全部滿足、且位於企業授權範圍內時，自動完成後續處置；
其餘案件轉補件或人工。Agent 不做最終核准、入帳、付款或稅務申報。

> 本 Repo 正在 `refactor` 分支依 CheckMate PRD 重建，現有程式碼仍是舊版模型。
> 進度見 [`docs/PROJECT_STATUS.md`](./PROJECT_STATUS.md)。

先讀這幾份，再開始動手：

- [`README.md`](../README.md) — 專案總覽
- [`docs/product/product-brief.md`](./product/product-brief.md)、[`product-scope.md`](./product/product-scope.md) — 產品方向與範圍
- [`AGENTS.md`](../AGENTS.md) — 完整開發規範與流程
- [`CLAUDE.md`](../CLAUDE.md) — **絕對不可違反的規則**（違反等於產品失效）

---

## 1. 環境需求

- Node.js **>= 20**
- pnpm **11.x**（`corepack enable` 後 `corepack prepare pnpm@11.22.0 --activate`）
- Docker Desktop（跑本機 Postgres / MinIO）

---

## 2. 一次把環境跑起來（照順序）

```bash
# 1) 安裝相依
pnpm install

# 2) 啟動本機基礎設施（Postgres + MinIO）
docker compose up -d

# 3) 建立環境變數檔（本機開發用預設值即可）
cp .env.example .env

# 4) 建立資料庫結構（套用 migration；不要用 db push）
pnpm --filter api prisma:migrate

# 5) 灌入 demo 案件
pnpm --filter api db:seed

# 6) 開兩個終端機分別啟動前後端
pnpm dev:api    # 後端 dev server
pnpm dev:web    # 前端 dev server
```

跑到這裡若前端能開、看得到 seed 的案件，環境就 OK 了。

---

## 3. 資料要重置時

```bash
pnpm --filter api db:reset   # DROP SCHEMA + migrate + seed，回到乾淨狀態
```

**不要用 `TRUNCATE` 或逐表 `DELETE`。** append-only 的表有 DB trigger 擋 DELETE，
而且 `AuditEvent` 的 hash chain 需要從頭重建才會一致。只有 `db:reset` 是乾淨的。

---

## 4. 開發流程：先寫 Spec，再寫測試，最後實作

本 repo **不使用 OpenSpec**（舊紀錄封存在 `docs/archive/openspec-m1/`）。

```text
User Story / Product Slice
→ specs/<slice-name>.md（User Story、Behavior、Acceptance Criteria、Edge Cases）
→ 把 Acceptance Criteria 轉成測試（先失敗）
→ 實作到測試通過
→ 對照 Acceptance Criteria 驗證
```

- 判斷標準：**這個改動會不會影響「產品行為」？** 會 → 先寫或更新 `specs/`。
- Spec 格式見 [`specs/README.md`](../specs/README.md)，撰寫時依
  [`docs/product/prd-review-criteria.md`](./product/prd-review-criteria.md) 檢查。
- 探索中的 UI、互動與文案可以先用 mock data 驗證，不強制先寫 Spec。
- 瑣碎改動（錯字、樣式微調、補測試）可直接做。
- 完整規範見 [`AGENTS.md`](../AGENTS.md)。

---

## 5. 哪些檔案「不要自己動」（先問 owner）

這些路徑在 [`.github/CODEOWNERS`](../.github/CODEOWNERS) 有指定擁有者，改動容易造成全隊災難：

| 路徑                                   | 為什麼危險                    | 要改怎麼辦                 |
| -------------------------------------- | ----------------------------- | -------------------------- |
| `apps/api/prisma/schema.prisma`        | 唯一真相來源，全隊依賴        | 開 issue 給 schema-owner   |
| `apps/api/prisma/migrations/`          | 已 commit 的 migration 不可改 | 只能**新增**一個 migration |
| `packages/shared/src/domain/`          | 前後端共用的領域邏輯          | 先問 schema-owner          |
| `CLAUDE.md` / `AGENTS.md` / `.claude/` | 專案規範與 agent 設定         | 先問 schema-owner          |
| `docs/product/` / `docs/design/`       | 產品決策，由 PM 定案          | 先和 PM 確認               |

**禁止 `prisma db push`**，一律 `prisma migrate dev`。

---

## 6. 開 PR 前必跑

```bash
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build
```

五個都要過（CI 也會跑，且為 merge 必要條件）。Commit 訊息走
[Conventional Commits](https://www.conventionalcommits.org/)（`feat:` / `fix:` / `chore:` ...）。

---

## 7. 卡住了找誰

- 環境 / DB 建不起來 → 看第 2、3 節，仍不行找 schema-owner。
- 不確定改動要不要先寫 Spec → 看第 4 節判斷標準，或直接問。
- 想改到第 5 節的受管檔案 → **一定先問 owner，不要自己動。**
