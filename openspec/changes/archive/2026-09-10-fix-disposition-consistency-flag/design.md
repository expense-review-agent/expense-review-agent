## Context

見 `proposal.md` — Why。相關約束：

- `Disposition` 是 append-only（DB trigger 擋 UPDATE/DELETE），寫錯的徽章無法修正。
- `schema.prisma` 的 `ConsistencyFlag` 註解已寫死算式（第 218–224 行），本 change 是
  「讓實作追上既有定案」，不是重新設計算式。
- DB CHECK `disposition_reason_required` 現況為
  `consistencyFlag NOT IN ('OVERRIDDEN','HUMAN_ASSUMED') OR reason 非空`
  （`20260908054924_governance_triggers_and_checks/migration.sql`）。
- seed 目前**不建立任何 `Disposition` 列**，正式環境無資料 → 無需回填腳本。
- `apps/api` 目前**沒有任何測試檔**（jest `rootDir: src`，`--passWithNoTests`），
  `packages/shared` 用 Node 內建 `node --test`。

## Goals / Non-Goals

**Goals：**

- 徽章計算成為 `packages/shared` 的**純函式**，輸入只有 `agentActionAtDecision` 與
  `finalAction`，前後端共用同一份、不得各自實作。
- `Disposition` 的 `finalAction` / `finalClassification` 承載真實的人工結論。
- 讓錯誤的輸入（人工判斷缺 `finalAction`、非人工判斷卻帶 `finalAction`）在碰 DB 前
  以 400 擋下。

**Non-Goals：**

- 不改 `ReviewerAction` / `RecommendedAction` / `Classification` 任何一個 enum。
- 不動 `disposition_reason_required` CHECK（見 Decisions 第 4 點：不需要動）。
- 不處理 §3-A 清單的其他缺陷（run 的 `inputSnapshot`、`currentRunId`、
  NORMAL fallback、body 驗證）——那些另開 change。
- 不實作前端 modal。本 change 只定案契約。

## Decisions

**1. 徽章算式放 `packages/shared/src/domain/disposition.ts`，與矩陣同檔**

新增 `deriveConsistencyFlag({ agentActionAtDecision, finalAction })`，回傳
`{ flag, reasonRequired }`。算式直接對應 `schema.prisma` 註解：

| `agentActionAtDecision` | `finalAction`     | flag               | reason |
| ----------------------- | ----------------- | ------------------ | ------ |
| （任意）                | `null`            | `PENDING_DECISION` | 否     |
| `null`                  | 非 null           | `HUMAN_ASSUMED`    | 是     |
| ≠ `MANUAL_REVIEW`       | = agent           | `CONSISTENT`       | 否     |
| ≠ `MANUAL_REVIEW`       | ≠ agent           | `OVERRIDDEN`       | 是     |
| `MANUAL_REVIEW`         | ≠ `MANUAL_REVIEW` | `HUMAN_ASSUMED`    | 是     |
| `MANUAL_REVIEW`         | = `MANUAL_REVIEW` | `ESCALATED`        | 否     |

同檔的理由：徽章與矩陣是同一組領域規則，分檔會讓兩者漂移。
替代方案（放 `apps/api`）已否決——`CLAUDE.md` 反模式第一條「想在單邊重新實作判定邏輯」。

**2. `escalates` 保留給「流程路由」，不再參與徽章計算**

`ACCEPT` on `MANUAL_REVIEW` 時 `finalAction = agentActionAtDecision = MANUAL_REVIEW`，
算式自然得出 `ESCALATED`——不需要 `escalates` 參與。`escalates` 僅保留給
「案件要不要進主管佇列」這件事。因此 `MANUAL_REVIEW + MANUAL_JUDGEMENT` 的
`escalates: true` 移除後，徽章仍正確（得出 `HUMAN_ASSUMED`），改變的只有路由語意
——而那正是要修的（人已下結論就不該再轉呈）。

**3. `finalClassification` 只在人工採用建議時等同 Agent 分類，否則為 `null`**

`RecommendedAction → Classification` 不是 1:1（`MANUAL_REVIEW` 可能來自 `EXCEPTION`
或 `HUMAN`），無法從人工指定的 `finalAction` 反推分類。而**分類是 Agent 的判定語彙，
人工不重新分類**——人工給的是「怎麼處理」，不是「這案子屬於哪一類」。所以：

- `finalAction == agentActionAtDecision` → `finalClassification = agentClassificationAtDecision`
- 其餘（含 `HOLD`）→ `finalClassification = null`

替代方案（硬湊一個分類）已否決——會造出 Agent 從未做出的判定，違反「Agent 不下最終
決定」的反面：人也不該被記成做了 Agent 式的分類。

**4. `PENDING_DECISION` 不需要動 DB CHECK**

現有 CHECK 是白名單反向寫法（`NOT IN ('OVERRIDDEN','HUMAN_ASSUMED')`），新值自動落在
「不需理由」那側，語意正確。**不新增、不修改任何 CHECK**——這讓 migration 只剩一行
`ALTER TYPE`，風險最小。

**5. migration 只做 `ALTER TYPE ... ADD VALUE`**

Postgres 16（`pgvector/pgvector:pg16`）允許在 transaction 內 `ADD VALUE`，但**同一個
transaction 內不得使用該新值**。本 migration 只加值、不寫資料也不改 CHECK，因此安全。
`prisma migrate dev` 會自動產生這行；**不修改任何已 commit 的 migration**。

**6. `MANUAL_JUDGEMENT` 的 `finalAction` 由請求體帶入，並嚴格驗證**

`dispositionRequestSchema` 新增 `finalAction?: RecommendedAction`。
API 在碰 DB 前檢查兩件事並回 400：

- `action === "MANUAL_JUDGEMENT"` 且無 `finalAction` → 400
- `action !== "MANUAL_JUDGEMENT"` 且有 `finalAction` → 400

第二條是刻意的嚴格：靜默忽略多餘欄位，會讓前端誤以為自己指定的結論生效了。

**7. `REASON_MISSING` 維持保留值，本 API 路徑不產生它**

理由缺漏一律以 400 擋下、不進 DB（`resolveDisposition` 與 `deriveConsistencyFlag`
都回報 `reasonRequired`，取聯集）。`REASON_MISSING` 留給資料匯入／歷史資料修補等
本 change 範圍外的路徑。替代方案（缺理由就寫 `REASON_MISSING`）已否決——該值不在
CHECK 的攔截名單內，會讓應被拒絕的寫入靜默成功。

**8. 測試分兩層**

- **徽章算式**：`packages/shared/src/__tests__/`，用既有 `node --test`。窮舉
  3 種 `agentActionAtDecision` × 4 種 `finalAction`（含 `null`）= 12 組全覆蓋，
  外加 `agentActionAtDecision = null` 的邊界。滿足 `CLAUDE.md`「徽章計算必須有測試」。
- **API 400 路徑**：`apps/api/src/review/review.service.spec.ts`，jest + 手寫 fake
  Prisma（`@nestjs/testing` 與 jest 已在相依內，**不新增任何套件**）。這會是 `apps/api`
  的第一個測試檔——目前 jest `rootDir: src` 掃不到任何檔，加了就會跑。

## Risks / Trade-offs

- **新增 enum 值後，舊的前端／查詢可能不認得 `PENDING_DECISION`** → `apps/web` 尚未
  實作，無遷移對象；`packages/shared` 的 enum-parity 測試會強制兩邊同步，漏改就紅。
- **`escalates` 語意變更影響主管佇列** → 主管佇列尚未實作（`features/audit/` 未開工），
  現在改的成本最低；`ACCEPT + MANUAL_REVIEW` 的轉呈路徑不受影響。
- **`finalClassification` 常為 `null`，稽核頁需處理空值** → 於 spec 明確定義何時為
  `null`，並在 `AuditEvent` payload 同時寫入 `finalAction`，稽核頁不必靠分類判讀。
- **本 change 動到 `schema.prisma` 與 `packages/shared/src/domain/`（CODEOWNERS 受管）**
  → 已由 schema owner 於提案階段明示授權（見 `proposal.md` — Impact）；PR 仍走
  CODEOWNERS 審查。
- **`ALTER TYPE ADD VALUE` 在 Postgres 無法回滾（不能 DROP enum value）** → 回滾方式是
  revert 程式碼、保留 enum 中的孤兒值（無害，無資料引用）。不嘗試寫「移除 enum 值」的
  down migration——那需要重建型別與所有引用欄位，風險遠高於留一個未使用的值。

## Migration Plan

1. `packages/shared`：新增 `deriveConsistencyFlag` + 修正矩陣 + 新增 enum 值 +
   補測試；`pnpm --filter shared test` 綠。
2. `schema.prisma` 加 `PENDING_DECISION` → `pnpm --filter api prisma:migrate`
   產生新 migration；確認產出的 SQL 只有一行 `ALTER TYPE`。
3. `pnpm --filter shared build`（api 吃 dist，漏了會拿到舊版——見 `PROJECT_STATUS.md`
   的節奏提醒）。
4. `apps/api`：`review.service.ts` 改用新算式與 `finalAction`；補 400 驗證；
   `AuditEvent` payload 增列欄位。
5. 補 api 測試 → `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 四關綠。
6. `pnpm --filter api db:reset` 後手動跑一次處置流程，確認四種徽章都能實際寫出。

**回滾**：revert PR。DB 側留下未使用的 `PENDING_DECISION` enum 值（無資料引用，無害）。
