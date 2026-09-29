# CLAUDE.md

本文件定義 AI 協作者在本 Repo 中的基本工作規則。產品方向以 **CheckMate** 的產品文件為準
（`docs/product/`、`docs/design/`、`specs/`），本 Repo 提供其後端、資料庫與前端實作。

> **目前版本**：對齊 CheckMate「Expense Case Review Prototype」，審查結果為預置的模擬資料
> （`source = PRESET`），由後端與資料庫保存，人工處理例外案件。尚無審查引擎與自動執行。
> 現況與下一步見 `docs/PROJECT_STATUS.md`。

---

## 1. 工作前先讀

依任務需要閱讀以下文件：

1. `README.md`：專案入口與整體脈絡
2. `docs/product/original-challenge.md`：原始命題與限制
3. `docs/product/product-discovery.md`：問題理解、證據與待驗證假設
4. `docs/product/product-brief.md`：產品方向與核心原則
5. `docs/product/product-scope.md`：目前版本範圍
6. `docs/design/`：視覺與互動規範
7. `specs/`：已收斂功能的行為規格（功能流程與例外情境寫在對應 Spec，不另維護全局 User Flow）
8. `docs/PROJECT_STATUS.md`：重構進度

不要只依既有程式碼推測產品需求。`docs/archive/` 是舊版文件，僅供參考歷史脈絡。

## 2. 文件優先順序

發生衝突時：

- 原始命題決定不可違反的外部限制。
- Product Brief 決定產品方向。
- Product Scope 決定目前版本要做與不做什麼。
- `specs/` 決定已收斂功能的具體行為。
- Design System 與 Interaction Patterns 決定介面與互動一致性。
- 本文件的工程規則決定實作方式，但不得推翻上述產品決策。
- 既有程式碼是實作結果，不是需求來源。

若文件彼此衝突，不要自行選擇答案；先指出衝突與影響。

## 3. 產品不可偏離的原則

- CheckMate 是 AI Expense Review & Control Agent，不是完整費用管理系統。
- 審查建議固定為：建議通過、建議補件、建議人工審核。
- Recommendation 與 Workflow Action 必須分開。
- Agent 只能在必要檢查完成、證據充分、規則明確、無阻擋風險、無未解決衝突且位於企業授權範圍內時自動執行。
- 資料不足、不確定、高風險或超出授權範圍時，必須轉補件或人工處理。
- 不執行最終核准、正式會計入帳、自動付款、正式稅務申報或最終法律判定。
- Demo 僅使用模擬資料。

## 4. 工程上不可違反的規則

以下是把上述產品原則落實到資料與程式層的保證，違反等於產品失效。

1. **每個 Finding 都必須能回溯到判斷依據**（規則代碼與條文、對應憑證或對照案件，
   `specs/review-case.md` 5.6）。沒有依據的 Finding 就是 bug；DB 層以 CHECK 約束保證，不要繞過。
2. **不指控。** 重複申報、拆單、真偽等風險訊號只能表述為「疑似」，不做舞弊或偽造的定論。
3. **資料不足不得建議通過。** 關鍵欄位缺漏、來源衝突、超出目前能判斷的範圍 → 建議補件或
   建議人工審核；「無法判斷」必須與「已確認有問題」分開呈現（`review-case.md` 4.7）。
   本輪只支援 TWD（DB 約束保證）。
4. **自動執行必須可被驗證。**（本輪不做自動執行）將來 Agent 執行任何 Workflow Action 前，
   必須留下自動執行條件逐項的評估結果；條件未全數滿足時，不得由 Agent 執行。
5. **原始結果永不消失。** 審查紀錄、處理紀錄、稽核事件只能新增，DB trigger 會擋
   UPDATE／DELETE／TRUNCATE。重新審查產生新的審查紀錄，不覆蓋舊紀錄；人工處理不改寫原始建議。
6. **判定必須可回放。** 每筆審查紀錄保存當時的判斷依據與憑證快照；接上審查引擎後，
   另外記錄引擎版本、規則版本與輸入快照。不得用新版規則回溯改寫舊紀錄。

## 5. 技術棧與架構

pnpm monorepo：

- `apps/web`：React + TypeScript + Vite + TanStack Query
- `apps/api`：NestJS + Prisma（PostgreSQL）
- `packages/shared`：Zod schema、型別與領域邏輯，前後端共用同一份

架構約定：

- **領域邏輯只寫一份，放在 `packages/shared`。** 檢查規則（如 E-01 金額比對）、審查建議推導、
  流程動作規則、顯示用的文案對照，前後端都引用同一份，不得各自實作。
  `domain/` 不依賴 zod，seed 會直接 import 其 TS 原始碼。
- **接上審查引擎時，執行審查的 API 設計成非同步**（回 `202` 與執行識別，前端輪詢狀態），
  之後替換引擎或接 OCR 只換 runner 實作，不改 API 契約。本輪沒有這支 API。
- **不引入 Redis / BullMQ / pgvector / 傳統 OCR 相依套件。** Product Scope 明列
  Production 等級的 Pipeline、Observability、Retry、Auth/RBAC 不在範圍。

### LLM 使用規則（目前選用 Gemini）

LLM 負責「看懂」與「模糊判斷」，固定規則負責「計算」與「下結論」。

- **只用在 Spec 定義的用途。** 目前只有 `specs/receipt-reading.md`（讀取憑證、擷取欄位）。
  新用途先寫 Spec，不順手加。
- **LLM 不決定審查建議、流程動作或自動執行。** 這些由 shared 的規則推導；LLM 的輸出
  只能成為規則的輸入或附依據的說明文字。
- **沒把握就說無法辨識，不猜。** 無法辨識的值不得以零、空白或推測值代替，
  進入規則時一律成為「無法判斷」。
- **輸出必須通過 schema 驗證。** 不合格式視為整次失敗，不採用部分結果。
- **每次呼叫都可回放。** 保存模型與版本、prompt 版本、輸入識別（含檔案雜湊）、原始回應、
  解析結果或失敗原因；紀錄只能新增。
- **只在後端呼叫。** 金鑰放在後端環境變數，前端不得直接呼叫 LLM 服務；
  供應商細節封裝在 api 的單一介面後面，換供應商不影響審查流程。
- **只送模擬資料。** 不送真實個人、財務或企業資料。
- 改 prompt 或換模型前，先用示範憑證的已知內容量測擷取準確度。

## 6. 資料庫

`apps/api/prisma/schema.prisma` 是唯一真相來源。

- **禁止 `prisma db push`。** 一律 `prisma migrate dev`。
- **禁止修改已經 commit 的 migration 檔案。** 要改就新增一個 migration。
  （2026-09-29 的 schema v4 已重設過一次基準，舊 migration 保留在 tag `era-m1-final`；此後不再重設。）
- DB 層的 trigger、CHECK 約束寫在 `*_governance/migration.sql`，說明見
  `prisma/migrations/GOVERNANCE_SQL.md`。這些是治理保證，不是可選項。
- 預置的審查結果寫入前，seed 會驗證它符合 shared 的產品規則並與 E-01 金額比對一致；
  改 `prisma/seed/fixtures.ts` 後跑 `pnpm --filter api seed:check`。
- schema 與 migrations 有指定 owner，見 `.github/CODEOWNERS`。需要改 schema 時**先問，不要自己動**。
- 重置資料一律用 `db:reset`，不要 `TRUNCATE` 或逐表 `DELETE`。

## 7. 開發方式

### Skill Discipline

開始任何新產品行為（新 User Story／Product Slice）或除錯任務前，
先確認 Superpowers 流程 skill（如 brainstorming、systematic-debugging）是否適用，
不得因為需求或問題描述已經很清楚而跳過檢查。

產品功能以可獨立驗收的 **User Story / Product Slice** 作為主要開發單位。

已收斂的非瑣碎產品行為，依以下流程進行：

```text
Product Direction
→ User Story / Product Slice
→ Spec + Acceptance Criteria
→ Test Strategy
→ Implementation
→ Verification
```

### Spec-Driven Development

- 尚未收斂的 UI、Interaction、資訊架構或文案，可以先用介面與 Mock Data 快速驗證，不強制先建立正式 Spec。
- 當功能行為已收斂且需要穩定實作時，再建立或更新 `specs/`（格式見 `specs/README.md`）。
- Spec 至少要包含 User Story / 使用情境、行為定義、Acceptance Criteria 與重要例外情境。
- 實作不得自行加入 Spec 沒有定義的新狀態、流程或產品決策。
- 若發現值得做但不屬於目前 Scope 的功能，不順手實作。

### Test-Driven Development

- 可自動驗證的核心領域邏輯與 Bug Fix 優先採 Test-first。
- 能由 Acceptance Criteria 直接轉成自動測試的行為，優先先定義測試再實作。
- 審查建議推導、自動執行條件評估、流程動作的合法性，這三處**必須有測試**。
- 純視覺調整、探索中的 Interaction 與一次性 Demo 細節，不要求形式化 TDD。
- 測試失敗時，不為了讓測試通過而修改正確的 Acceptance Criteria。
- 若 Spec、Test 與實作互相衝突，先回到產品規則釐清。

**目前不使用 OpenSpec。** 不要建立 `openspec/`、Change Proposal、Archive 或相關流程，
除非後續明確決定導入。舊的 OpenSpec 紀錄封存在 `docs/archive/openspec-m1/`，僅供參考。

Bug Fix、Refactor、Chore、Spike 等非產品功能變更可以獨立處理，不需要硬包成 User Story，
但仍需有清楚範圍與驗證方式。

## 8. 目前開發原則

目前階段優先順序：

1. 核心審查流程清楚且可操作
2. Demo 情境完整
3. 資訊架構與互動一致
4. 核心產品行為可驗證
5. 再考慮工程完整度

避免為尚未確認的需求建立過度抽象、過度泛化或 production-grade 的基礎設施。

## 9. UI 與 UX

- 專業、可信任、冷靜、清楚。
- Review-first、Risk-first、Evidence-first。
- 先呈現結論與需要使用者處理的事項，再逐步展開細節。
- 不使用 Emoji 作為 UI icon。
- 使用一致的 icon system（Lucide React）。
- UX Writing 採台灣常用、直接、可操作的用語。
- 不使用模糊或擬人化的 AI 文案掩蓋系統實際行為。
- 不自行發明新的 Status、Recommendation、Action wording 或 Icon 語意。
- 不只靠顏色傳達重要狀態。

## 10. 規格與實作邊界

- 不因「未來可能會用」提前加入未進 Scope 的功能、套件或基礎設施。
- 不為了配合既有 Code 而改寫已定案的產品規則。
- 不把 Mock Data 或 Demo 邏輯包裝成已完成的 Production 能力。
- 發現需求超出 Product Scope、需要新增產品流程或自動化權限時，先提出再實作。

## 11. PRD Review Criteria

撰寫或修改 User Story、User Flow、Edge Case、PRD、Feature Spec、Acceptance Criteria 時，
須依 `docs/product/prd-review-criteria.md` 檢查，依文件所處階段套用不同嚴謹度：

- **探索／全局骨架階段**（例如 User Flow、Edge Case Map 等尚未收斂的文件）：Criteria 用來幫助思考與避免遺漏，
  不要求每個不適用項目都形式化標示 N/A。但不能因此掩蓋真正未決的產品問題。
- **Feature Spec／Acceptance Criteria 階段**：需逐項套用 Criteria；不適用項目應標示 N/A 並簡要說明原因，不可直接忽略。
- 檢查須在撰寫階段主動進行，不是只在文件完成後才回頭 Review。
- 內容應放在正確的文件層級（例如 User Flow 不需要涵蓋效能門檻）。
- 這是撰寫過程的內部檢查依據，不是交付內容。發現的缺漏要直接修進文件對應段落；
  不要把檢查清單、逐項 N/A 說明等過程紀錄留在交付給團隊的文件裡。

## 12. 反模式

看到以下情況，停下來問，不要自己決定：

- 想在 `apps/web` 或 `apps/api` 重新實作一份判定邏輯（應該用 `packages/shared`）
- 想讓 LLM 直接給出審查建議、決定流程動作，或把 LLM 的說明當成判斷依據
- 想在前端直接呼叫 LLM 服務
- 想加新的 npm 套件
- 想改 `schema.prisma` 或 migration
- 想繞過 DB 約束（改成應用層驗證、或加 `-- @skip` 之類）
- 想為了相容舊程式碼而保留 CheckMate 文件沒有的狀態、動作或用語
- 想「順便」重構不在本次任務範圍的檔案
- 測試跑不過，於是改測試而不是改實作

## 13. 寫程式的風格

- 領域邏輯放 `packages/shared/src/domain`（純 TS）；API 契約用 Zod 定義在 `api.ts`。
- 金額一律 `Prisma.Decimal`（前端與 shared 以字串傳遞），**不要用 JS number 做金額運算**。
  浮點誤差會讓比對結果不穩定，這在對帳產品是致命的。加總與格式化用 shared 的 `money.ts`（BigInt 分）。
- enum 值用英文，並與 `domain/vocabulary.ts` 一一對應（enum-parity 測試）；
  顯示文案集中在 `presentation/labels.ts`。

## 14. 指令

```bash
pnpm dev:api                      # 後端 dev server
pnpm dev:web                      # 前端 dev server
pnpm --filter api prisma:migrate  # 套用 migration
pnpm --filter api db:reset        # 重建 8 筆 demo 案件（會清空資料與處理紀錄）
pnpm --filter api seed:check      # 不連 DB，驗證 demo 案例是否自洽
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm build   # 開 PR 前必跑
```

改了 `packages/shared` 一定要 `pnpm --filter shared build`，否則 api（吃 dist）拿到舊版。
