# CLAUDE.md

Claude Code 每次對話都會載入這份檔案。內容只放「違反了就會出錯」的規則。
背景說明與需求細節放在 `openspec/` 與 `docs/`，需要時再讀。

---

## 專案

expense-review-agent — 疊加在既有費用系統之上的 AI 費用單據初審 Agent。
Agent 提出建議，人做決定。目前只做 **M1 Review Copilot**。

- **M1-U1** 財務初審人員依 Agent 結果完成初審
- **M1-U2** 財務主管可追溯 Agent 與人工判斷

M2（風險情報）、M3（自動處置）**不在本階段範圍**。看到任何 M2/M3 的東西，
不要順手實作，寫進 `openspec/backlog.md`。

## 技術棧

pnpm monorepo：`apps/web`（React + TS + Vite + TanStack Query）、
`apps/api`（NestJS + Prisma）、`packages/shared`（Zod schema 與型別，前後端共用）。
PostgreSQL、S3/MinIO。

**M1 不使用 Redis / BullMQ / pgvector。** 這些是 M2/M3 的東西，不要引入。
Review run 在 M1 是同步執行的純運算，但 **API 必須設計成非同步**：
`POST /cases/:id/runs` 回 `202 + runId`，前端輪詢 run 狀態。
之後接 OCR 只換 runner 實作，不改 API 契約。

---

## 絕對不可違反的領域規則

這幾條是產品的責任邊界，不是風格偏好。違反等於產品失效。

1. **Agent 不下最終決定。** 不執行入帳、付款、稅務申報、發票合法性認定、舞弊定罪。
2. **每個非通過結論都必須有證據。** `RuleResult` / `MatchResult` 沒有對應的
   `Evidence` 就是 bug。DB 有 CHECK 約束擋，不要繞過。
3. **不指控。** `RuleDefinition.isSuspicionOnly = true` 的規則（R7 重複、R8 拆單）
   只能表述為「疑似」。這是產品層 guardrail，組織設定不可覆寫。
4. **資料不足不硬判 NORMAL。** 關鍵欄位低信心、來源衝突、非 TWD 幣別
   → MISSING 或 HUMAN，不得判通過。
5. **原始結果永不消失。** `AuditEvent` / `Disposition` / `SupervisorReview`
   是 append-only，DB trigger 會擋 UPDATE 與 DELETE。
   任何「修正歷史紀錄」的需求都是新增一筆事件，不是改舊的。
6. **判定必須可回放。** 每個 run 記錄當時的 `policyVersionId`、`engineVersion`
   與 `inputSnapshot`。不得用新版 Policy 回溯評斷舊案件。

## 已定案的決策（不要重新發明）

以下都經過討論定案，實作時直接照做。要改必須先開 OpenSpec proposal。

**分類與處置**

- 四分類 `NORMAL / EXCEPTION / MISSING / HUMAN` → 三桶建議
  `APPROVE / REQUEST_INFO / MANUAL_REVIEW`。EXCEPTION 與 HUMAN 都對應 MANUAL_REVIEW。
- 合法動作矩陣定義在 `packages/shared/src/domain/disposition.ts`，
  前後端都必須引用同一份，不得各自實作。
- `ACCEPT` 在不同建議下語意不同：APPROVE → 通過；REQUEST_INFO → 補件；
  MANUAL_REVIEW → **轉呈主管，reviewer 不下結論**。
- 一致性徽章 `ConsistencyFlag` 由 `finalAction` 與 `agentActionAtDecision`
  計算後**固化寫入**，不得在 UI 端即時重算（Policy 改版會讓歷史徽章翻臉）。

**案件狀態**

- `DRAFT → QUEUED → (AWAITING_INFO) → DISPOSED → REVIEW_CLOSED`
- **沒有「已不通過」終態。** 最終核准與否屬既有系統職責。
- 主管退回一律回 `QUEUED`。

**規則引擎**

- 規則分兩層：`RuleDefinition`（系統型錄，走 i18n，產品擁有）與
  `PolicyRule`（組織設定，存條文原文，客戶擁有、後台可編輯）。
  新增檢查類型 = 加 definition；調整額度門檻 = 改 policy rule 的 params。
- 依賴一致性的規則採**雙假設評估**：比對不一致時，以申報值與單據值各跑一次。
  兩者結論相同 → 照常輸出 PASS/FAIL（`BOTH_AGREE`）；
  分歧 → `GATED` 並附 `gateReasonKey`。**絕不可因比對失敗就靜默跳過規則**，
  那是漏判，是這個產品最不能犯的錯。
- 規則結果五種：`PASS / FAIL / GATED / ABSTAIN / PENDING_HUMAN`。

**擷取（分階段）**

- Phase 1：不做 OCR。以 seed 的結構化 JSON 或介面表單為判斷依據
  （`ExtractionSource.STRUCTURED_FIXTURE` / `MANUAL_FORM`）。
- Phase 2 才接 OCR。**不要提前引入 OCR 相依套件。**

**i18n 邊界**

- 系統訊息、狀態、規則判定理由 → `messageKey` + `messageParams`，**DB 不存中文**。
- 組織自訂的 Policy 條文（如「§4.2 住宿每晚上限 NT$4,000」）→ **存原文**，不 key 化。
- 人工填寫的覆寫／稽核理由 → 自由文字，原樣保存。

---

## 資料庫

`apps/api/prisma/schema.prisma` 是唯一真相來源。

- **禁止 `prisma db push`。** 一律 `prisma migrate dev`。
- **禁止修改已經 commit 的 migration 檔案。** 要改就新增一個 migration。
- DB 層的 trigger、CHECK、EXCLUDE 約束寫在 migration 的 SQL 裡
  （schema.prisma 檔末有完整清單）。這些是治理保證，不是可選項。
- schema 與 migrations 有指定 owner，見 `CODEOWNERS`。
  需要改 schema 時**先問，不要自己動**。

## 指令

```bash
pnpm dev:api                      # 後端 dev server
pnpm dev:web                      # 前端 dev server
pnpm --filter api prisma:migrate  # 套用 migration
pnpm --filter api db:seed         # 重建 10 筆 demo 案件（會清空資料）
pnpm lint && pnpm typecheck && pnpm test && pnpm build   # 開 PR 前必跑
```

## 工作流程

本 repo 走 spec-driven development，用 OpenSpec （skills 見 `.claude/skills/openspec-*`）。

- 想清楚要做什麼 → `openspec-explore`（只思考，不寫程式）
- 決定要做 → `openspec-propose` 產出 proposal / specs / design / tasks
- 開始實作 → `openspec-apply-change`
- 實作完成 → 交給 schema owner 執行 `openspec-sync-specs` 與 `openspec-archive-change`

任何非瑣碎的改動**先在 `openspec/changes/` 開 proposal，再寫程式**。
完整規範見 `AGENTS.md`。

瑣碎改動（錯字、樣式微調、補測試）可直接做。
判斷標準：**會不會影響領域行為？** 會 → 先寫 proposal。

## 反模式

看到以下情況，停下來問，不要自己決定：

- 想在 `apps/web` 重新實作一份判定邏輯（應該用 `packages/shared`）
- 想加新的 npm 套件（先問，M1 相依套件已經夠了）
- 想改 `schema.prisma` 或 migration
- 想繞過 DB 約束（改成應用層驗證、或加 `-- @skip` 之類）
- 想把中文字串寫進 DB 的 `messageKey` 欄位
- 想「順便」重構不在本次任務範圍的檔案
- 測試跑不過，於是改測試而不是改實作

## 寫程式的風格

- 領域邏輯放 `packages/shared`，用 Zod 定義並匯出型別，不要在兩邊各寫一份。
- 金額一律 `Prisma.Decimal`，**不要用 JS number 做金額運算**（浮點誤差會讓
  比對結果不穩定，這在對帳產品是致命的）。邊界轉換寫在 DTO 層。
- enum 值用英文，顯示文案走 i18n map。
- 新增領域行為時同時補測試。矩陣、徽章計算、雙假設評估這三處**必須有測試**。
