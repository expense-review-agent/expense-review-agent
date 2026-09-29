# 治理 SQL（schema v4）

Prisma schema 無法表達的資料庫層保證，寫在 `*_governance/migration.sql`。
應用層會先驗證並回傳友善的錯誤訊息，但資料庫是最後一道防線，**不可繞過**。

| #   | 保證                                       | 做法                                                           | 對應依據                                        |
| --- | ------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------- |
| 1   | 審查紀錄與處理紀錄永不消失、不被改寫       | 6 張 append-only 表的 UPDATE／DELETE／TRUNCATE 由 trigger 擋下 | CLAUDE.md 工程規則 5；`review-case.md` 4.8、5.7 |
| 2   | 每個 Finding 都能回溯到判斷依據            | `ruleText` 不得為空；`comparison` 必須是 JSON 陣列             | `review-case.md` 4.9、5.6                       |
| 3   | 人工處理必須留下原因                       | 只有「建議通過」的案件完成初審可以不填；退回補件一律要填       | `interaction-patterns.md` 本輪工作台操作提案    |
| 3   | 動作與結果狀態一致                         | PROCEED → 已完成初審；REQUEST_INFO → 待補件                    | 同上                                            |
| 4   | 只能處理最新審查紀錄；原始建議快照不可偽造 | INSERT trigger 比對該案件 `seq` 最大的審查紀錄                 | 同上；「歷史紀錄可查看，不能處理」              |
| 4   | 同一筆審查紀錄只處理一次                   | `WorkflowActionRecord.reviewId` unique（schema）               | 「處理後不再提供重複送出入口」                  |
| 5   | 本輪只支援 TWD；金額不得為負               | CHECK                                                          | `amount-check.md`「單一 TWD」                   |

append-only 的表：`ReviewRecord`、`CheckResult`、`Finding`、`ReviewReceipt`、`WorkflowActionRecord`、`AuditEvent`。

`ExpenseCase.status` 是可更新的投影（處理進度），由流程動作在同一交易內推進，不在 append-only 範圍。

重置資料一律用 `pnpm --filter api db:reset`（DROP SCHEMA 重建）；`TRUNCATE`／`DELETE` 會被 trigger 擋下，
而且稽核事件的 hash chain 需要從頭重建才會一致。
