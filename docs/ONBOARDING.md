# 組員上手指南（Contributor Onboarding）

> 目標：**沒有相關開發經驗的組員，照這份文件由上到下跑一遍，就能把 app 跑起來
> 並進入功能開發。** 對應 OpenSpec change：`bootstrap-m1-foundation`（tasks §5.1）。
>
> 前端技術棧為 **React + TypeScript + Vite + TanStack Query**（團隊已決定）。

---

## 0. 這個專案在做什麼（30 秒版）

疊加在既有費用系統之上的 **AI 費用單據初審 Agent**：Agent 讀單據、比對、跑規則，
把每筆案件分成「建議通過 / 建議補件 / 建議人工審核」，**但最終決定永遠是人做的**。
目前只做 **M1 Review Copilot**（M1-U1 初審、M1-U2 主管稽核）。M2/M3 不在範圍內。

先讀這三份，再開始動手：

- [`README.md`](../README.md) — 專案總覽
- [`AGENTS.md`](../AGENTS.md) — 完整開發規範與流程
- [`CLAUDE.md`](../CLAUDE.md) — **絕對不可違反的領域規則**（違反等於產品失效）

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

# 5) 灌入 10 筆 demo 案件
pnpm --filter api db:seed

# 6) 開兩個終端機分別啟動前後端
pnpm dev:api    # 後端 dev server
pnpm dev:web    # 前端 dev server
```

> ⚠️ 若 `db:seed` / `db:reset` 指令還不存在，代表 `bootstrap-m1-foundation`
> 的 §4 尚未 apply，先找 schema-owner 確認進度。

跑到這裡若前端能開、看得到 seed 的案件，環境就 OK 了。

---

## 3. 資料要重置時

```bash
pnpm --filter api db:reset   # DROP SCHEMA + migrate + seed，回到乾淨狀態
```

**不要用 `TRUNCATE` 或逐表 `DELETE`。** append-only 的表有 DB trigger 擋 DELETE，
而且 `AuditEvent` 的 hash chain 需要從頭重建才會一致。只有 `db:reset` 是乾淨的。

---

## 4. 開發流程：先提案，再寫程式（spec-driven）

本 repo 用 **OpenSpec**。**任何非瑣碎的改動都要先開 proposal，再寫程式。**

```bash
# 想清楚要做什麼（只思考，不寫程式）
openspec new change "<change-id>"        # kebab-case，例如 add-review-queue-api
# 依序補齊 proposal → specs → design → tasks（每步用 instructions 拿模板）
openspec instructions proposal --change "<change-id>" --json
# ...
openspec validate --changes "<change-id>" --json   # 注意：validate 用 --changes（複數）
```

- 判斷標準：**這個改動會不會影響「領域行為」？** 會 → 先寫 proposal。
- 瑣碎改動（錯字、樣式微調、補測試）可直接做。
- 完整規範見 [`AGENTS.md`](../AGENTS.md)。

> CLI 旗標易錯點：`status` / `instructions` / `new change` 用 `--change`（單數）；
> `validate` 用 `--changes`（複數）。

---

## 5. 哪些檔案「不要自己動」（先問 owner）

這些路徑在 [`CODEOWNERS`](../CODEOWNERS) 有指定擁有者，改動容易造成全隊災難：

| 路徑                                   | 為什麼危險                    | 要改怎麼辦                        |
| -------------------------------------- | ----------------------------- | --------------------------------- |
| `apps/api/prisma/schema.prisma`        | 唯一真相來源，全隊依賴        | 開 issue/proposal 給 schema-owner |
| `apps/api/prisma/migrations/`          | 已 commit 的 migration 不可改 | 只能**新增**一個 migration        |
| `packages/shared/src/domain/`          | 前後端共用的矩陣/契約         | 先問 schema-owner                 |
| `CLAUDE.md` / `AGENTS.md` / `.claude/` | 專案規範與 agent 設定         | 先問 schema-owner                 |

**禁止 `prisma db push`**，一律 `prisma migrate dev`。

---

## 6. 開 PR 前必跑

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

四個都要過（CI 也會跑，且為 merge 必要條件）。Commit 訊息走
[Conventional Commits](https://www.conventionalcommits.org/)（`feat:` / `fix:` / `chore:` ...）。

---

## 7. 卡住了找誰

- 環境 / DB 建不起來 → 看第 2、3 節，仍不行找 schema-owner。
- 不確定改動要不要先寫 proposal → 看第 4 節判斷標準，或直接問。
- 想改到第 5 節的受管檔案 → **一定先問 owner，不要自己動。**
