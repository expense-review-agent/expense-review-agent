# 專案現況：依 CheckMate PRD 重構

> 對象：專案成員。說明本 Repo 為什麼重構、重構分幾個階段、目前做到哪、哪些事還沒定案。
> 分支：`refactor`（從 `main` 的 `1219971` 開出；重構前的版本打了 tag `era-m1-final`，可隨時回退）。
> 舊版進度文件封存在 [`archive/PROJECT_STATUS-m1.md`](./archive/PROJECT_STATUS-m1.md)。

---

## 1. 為什麼重構

PM 已確認以 **CheckMate** 的 PRD 作為最新版本，Demo 也以此為主。
舊版 expense-review-agent（M1 Review Copilot）和 CheckMate 的產品方向有根本差異：

| 面向         | 舊版（M1 Review Copilot）                        | CheckMate                                              |
| ------------ | ------------------------------------------------ | ------------------------------------------------------ |
| 定位         | Agent 只提建議，由人決定；自動處置（M3）不在範圍 | Agent 在控制條件與企業授權下自動完成部分處置           |
| 流程動作     | 採用建議／退回補件／人工判斷／保留，加上主管稽核 | PROCEED／REQUEST_INFO／ESCALATE，另有人工覆寫 OVERRIDE |
| 自動執行條件 | 無                                               | 六項條件全部滿足才能自動執行（P0）                     |
| 主管角色     | 核心流程（M1-U2）                                | 目前只作為稽核紀錄查閱者                               |
| 判定結果     | 四分類、規則結果五態                             | 發現項目（Finding）：來源、嚴重程度、對建議的影響      |
| 開發流程     | OpenSpec                                         | `specs/` + Spec 先行 + Test-first                      |

因此保留舊版的工程骨架（monorepo、NestJS、Prisma、CI、只能新增的稽核紀錄與 hash chain），
把領域模型整套換成 CheckMate 的。

## 2. 重構階段與進度

| 階段 | 內容                                                                                                  | 規模 | 狀態          |
| ---- | ----------------------------------------------------------------------------------------------------- | ---- | ------------- |
| 0    | 產品決策定案（見第 3 節）                                                                             | —    | 🟡 待 PM 確認 |
| 1    | 換掉規範文件：導入 CheckMate 文件、改寫 CLAUDE.md／AGENTS.md／README、封存 OpenSpec                   | 小   | ✅ 完成       |
| 2    | 把 CheckMate 的領域模型與審查引擎（含測試）搬進 `packages/shared`，補上流程動作、執行者、自動執行條件 | 中   | ⬜ 未開始     |
| 3    | 重建 schema v4 基準（見第 4 節），重寫治理約束                                                        | 大   | ⬜ 未開始     |
| 4    | 審查引擎接上 API、自動執行、流程動作 API；刪除主管稽核與舊處置 API                                    | 中   | ⬜ 未開始     |
| 5    | 依新模型重寫 seed：舊版十情境 + CheckMate 案例、5–8 條企業規範、1–2 條台灣法規                        | 中   | ⬜ 未開始     |
| 6    | 前端改版：建議卡片、發現項目／佐證、動作列與確認視窗、稽核時間軸；emoji 換成 Lucide                   | 中   | ⬜ 未開始     |
| 7    | 驗證：`specs/` 的 Acceptance Criteria 皆有自動測試、CI 全綠、Demo 正常與例外路徑手動走過              | 小   | ⬜ 未開始     |

### 階段一完成內容

- 導入 CheckMate 的 `docs/product/`、`docs/design/`、`specs/`（內容原封不動，以 CheckMate Repo 為準）。
- 改寫 `CLAUDE.md`：以 CheckMate 規範為主，保留仍成立的工程規則（佐證必備、不指控、
  資料不足不得建議通過、紀錄只能新增、判定可回放、金額用 Decimal、不准 `db push`），
  刪除與 CheckMate 衝突的舊規則（M1/M2/M3 範圍、四分類、ACCEPT 語意、一致性徽章、主管流程）。
- 改寫 `AGENTS.md`、`README.md`、`docs/ONBOARDING.md`、PR 範本；`docs/API_SPEC.md` 標示為舊版。
- `openspec/` 封存到 `docs/archive/openspec-m1/`；移除 OpenSpec 指令與 skill，以及綁定舊模型的
  `expense-rule`、`demo-case` skill。
- **程式碼尚未修改**：`apps/`、`packages/` 仍是舊版模型，CI 行為不變。

## 3. 產品決策狀態（2026-09-29 依 CheckMate 最新文件更新）

CheckMate 在 2026-09-28 大幅更新：刪除 `user-flow.md`、`edge-cases.md`（流程與例外改寫在各 Spec），
重寫 `specs/review-case.md`，新增 `specs/amount-check.md`，Product Scope 改為「本輪 Prototype」＋「Demo Day 目標」兩段。
本 Repo 已重新同步。原本列出的待定事項，現況如下：

| 事項                           | 現況                                                                                                          | 來源                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| OVERRIDE 的定位                | ✅ 已定案：人工決策覆寫，覆寫後仍需接續流程動作；保留原始建議、原因、執行者與時間                             | `product-brief.md`                      |
| Agent 與人工的動作             | ✅ 已定案：共用 PROCEED／REQUEST_INFO／ESCALATE，執行者記錄在稽核紀錄                                         | `product-brief.md`                      |
| Agent 自動執行                 | ⚠️ **本輪不做**；屬 Demo Day「受控處置」目標，授權條件留待對應 Slice                                          | `product-scope.md`                      |
| 建議通過但無權自動執行時的狀態 | 🟡 留待對應 Slice                                                                                             | `product-scope.md` 玖                   |
| 「無法判斷」                   | ✅ 已定案：Check Result 分通過／未通過／無法判斷／不適用；無法判斷 → 建議人工審核，且須與「已確認有問題」區分 | `review-case.md` 4.7、5.3               |
| 金額不一致                     | ✅ 已定案：以最小貨幣單位精確比對、不設容許誤差，一律建議人工審核                                             | `review-case.md` 4.3、`amount-check.md` |
| 5–8 條企業規範的條件           | 🔴 **未定案，不得由工程或 AI 自行補完**                                                                       | `review-case.md` 7                      |
| 疑似重複的判斷條件             | 🔴 **未定案，不得由工程或 AI 自行補完**                                                                       | `review-case.md` 7                      |
| 合規規則（來源與版本）         | 🔴 **未定案**；來源未確認前只能稱 Demo Compliance Rule                                                        | `review-case.md` 5.2、7                 |
| Finding 是否需要嚴重程度欄位   | 🔴 未定案                                                                                                     | `review-case.md` 7                      |
| 處理進度分流                   | ✅ 待處理／待補件／已完成初審／全部                                                                           | `interaction-patterns.md`               |

**與 2026-09-28 的決定衝突之處**：當時選了「Agent 三種動作都可自動執行」與「無法判斷類處理先不沿用」。
前者與最新 Scope 的「本輪不做自動執行」不一致；後者已被 `review-case.md` 4.7 納入規格。需要重新確認，見第 6 節。

## 4. 階段三 schema v4 規劃（草案）

因為資料庫只有 seed 資料，階段三將清掉舊 migration，重新產生一份 v4 基準 migration，
由 schema owner 執行並通知所有人跑 `db:reset`。

| 處理方式     | 資料表                                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 保留（小改） | Organization、User、StoredFile、PolicyDocument／PolicyVersion／PolicyRule、ExpenseCase、CaseDocument、ExpenseLine、Receipt、ExtractedField、ReviewRun、Evidence、AuditEvent（含 hash chain） |
| 合併         | RuleResult + MatchResult → Finding（來源、嚴重程度、對建議的影響、規則參照），佐證改掛在 Finding 上                                                                                          |
| 取代         | Disposition → WorkflowActionEvent（執行者類型、動作、是否覆寫與理由、當時的建議快照；Agent 執行時 actorId 可為空）                                                                           |
| 新增         | ReviewRun 上的自動執行條件評估結果（六項條件、是否通過）                                                                                                                                     |
| 刪除         | SupervisorReview、ConsistencyFlag、Classification、RuleOutcome、EvaluationBasis                                                                                                              |

治理約束：WorkflowActionEvent 與 AuditEvent 只能新增；阻擋型 Finding 必須附佐證；
覆寫必須填理由；Agent 只有在自動執行條件通過時才能寫入流程動作。

最終版本依第 3 節的決策結果調整。

## 5. 對團隊的影響

- 遠端的 `Fanny`、`Nancy` 等分支是舊模型，重構後幾乎無法直接合併。
  開始階段二前，請先把手上的工作合併或暫停。
- 階段三完成後，所有人都要重新 `pnpm --filter api db:reset`。
- 重構期間 `main` 保持舊版可運作；`refactor` 完成並驗證後再合併。
- Demo 部署需要 Postgres 與 API 主機，比 CheckMate 前端原型（純靜態）複雜，需提早確認環境。

## 6. 待重新確認（階段二開工前）

CheckMate 目前的 Prototype 是純前端、使用預置分析結果；Product Scope 把「實際初審引擎」與「受控處置」
列為 Demo Day 目標。因此本 Repo 重構的目標需要重新確認：

1. 重構後的第一個可交付版本，要對齊 CheckMate「本輪 Prototype」（人工處理例外、無自動執行），
   還是直接做 Demo Day 目標（實際引擎＋受控自動執行）？
2. 第 3 節標 🔴 的規則條件（企業規範、重複判斷、合規規則）尚未定案。在 PM 定案前，
   引擎可以先支援「條件類型」，實際門檻以標示為「Demo 規則（待定案）」的 seed 資料暫代，是否接受？
