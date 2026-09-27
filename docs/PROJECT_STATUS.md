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

## 3. 待定案的產品決策（階段二開工前需要）

以下問題會直接影響資料模型，CheckMate 文件目前沒有定案或前後不一致，需要 PM 確認：

1. **OVERRIDE 的定位**：`product-brief.md`／`product-scope.md` 把 OVERRIDE 列為流程動作之一；
   `user-flow.md` 則說 OVERRIDE 不是流程動作，覆寫後仍須接續 PROCEED／REQUEST_INFO／ESCALATE。
2. **Agent 可自動執行的動作範圍**：只有 PROCEED，還是 REQUEST_INFO、ESCALATE 也可以？
   README 說 Agent 可通知補件、轉交人工；`user-flow.md` 只描述自動 PROCEED。
3. **「建議通過但不能自動執行」的案件狀態**：`edge-cases.md` 列為待確認。
4. **舊版的兩種邊界處理是否沿用**：
   - 比對不一致時以申報值與單據值各評估一次、結論分歧就視為「未解決衝突」；
   - 非 TWD、關鍵欄位低信心時主動退讓轉人工。
     兩者都符合 CheckMate 原則，但會改變 `specs/review-case.md` 的現有行為，需先確認。
5. **規範數值**：住宿上限在 CheckMate 引擎是 5,000，舊版 seed 是每晚 4,000。

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
