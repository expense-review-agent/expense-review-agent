# 後端 API 規格（schema v4）

> 對齊 CheckMate「Expense Case Review Prototype」（`docs/product/product-scope.md` 壹）與 `specs/review-case.md`。
> 所有型別與請求／回應的 zod schema 定義在 `packages/shared/src/api.ts`，前後端引用同一份。
>
> 慣例：REST + JSON，全域前綴 `/api`；案件以案件編號（`EXP-2026-001`）識別；
> 金額一律以字串傳遞（避免浮點誤差）；日期為 `YYYY-MM-DD`，時間為 ISO 8601。
> 錯誤回應沿用 NestJS 格式 `{ statusCode, message, error }`，`message` 為可直接顯示的中文。

## 端點總表

| Method | Path                             | 用途                               |
| ------ | -------------------------------- | ---------------------------------- |
| GET    | `/api/health`                    | 健康檢查                           |
| GET    | `/api/cases`                     | 案件列表（工作台）                 |
| GET    | `/api/cases/:caseNumber`         | 案件詳情，含全部審查紀錄與處理紀錄 |
| POST   | `/api/cases/:caseNumber/actions` | 人工完成初審或退回補件             |
| POST   | `/api/cases/batch-complete`      | 批次完成「建議通過」案件的初審     |
| GET    | `/api/cases/:caseNumber/audit`   | 稽核軌跡與 hash chain 驗證結果     |

本輪沒有執行審查的端點：審查結果為預置的模擬資料（`source = PRESET`）。
接上審查引擎時再新增，且設計成非同步（見 `CLAUDE.md`）。

## GET /api/cases

回傳全部案件，依案件編號排序。處理進度分流、搜尋與建議篩選在前端以 shared 的
`filterByProgress`／`filterCases` 處理。

```json
{
  "items": [
    {
      "caseNumber": "EXP-2026-003",
      "summary": "新竹供應商會議往返交通費",
      "applicantName": "王柏翰",
      "department": "產品部",
      "category": "交通費",
      "amount": "1680",
      "currency": "TWD",
      "submittedAt": "2026-09-21",
      "recommendation": "MANUAL_REVIEW",
      "agentSummary": "申請金額比憑證多 NT$200",
      "status": "PENDING"
    }
  ]
}
```

- `recommendation`、`agentSummary` 取自**最新一筆**審查紀錄；`agentSummary` 是第一個 Finding 的標題，沒有 Finding 時為「資料齊全，核對無誤」。
- `status`：`PENDING`（待處理）／`AWAITING_INFO`（待補件）／`REVIEW_COMPLETED`（已完成初審）。

## GET /api/cases/:caseNumber

找不到案件回 `404`。主要欄位：

| 欄位           | 說明                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------- |
| `lines`        | 費用明細；`netAmount`／`taxAmount` 未提供時為 `null`，不由總額反推；`receiptKeys` 為對應憑證 |
| `receipts`     | 展示用模擬憑證；`imagePath` 指向前端 `public/fixtures/` 下的圖檔                             |
| `reviews`      | 審查紀錄，由舊到新，至少一筆；最後一筆是最新                                                 |
| `latestAction` | 最新審查紀錄的人工處理紀錄；尚未處理時為 `null`                                              |
| `reviewDiff`   | 最新與前一次審查的差異（建議是否改變、新增與已解決的 Finding）；只有一筆審查紀錄時為 `null`  |

每筆審查紀錄：

- `checks`：四個面向各一筆，依 `EVIDENCE_MATCH`、`CORPORATE_POLICY`、`COMPLIANCE`、`RISK_SIGNAL` 排序；
  `status` 為 `PASS`／`FAIL`／`UNDETERMINED`／`NOT_APPLICABLE`。
- `findings`：`kind` 為 `MISSING`（可補正缺漏）／`ANOMALY`（已確認的異常）／`UNDETERMINED`（系統無法判斷）；
  每筆都有 `ruleText`（判斷依據），`comparison` 為關鍵數值對照，`relatedCaseNumber` 為疑似重複的對照案件。
- `receiptKeys`：**當次審查時**已提供的憑證。歷史紀錄不顯示後來補入的附件。

## POST /api/cases/:caseNumber/actions

```json
{ "reviewKey": "REV-003-1", "action": "PROCEED", "reason": "已核對額外交通費證明" }
```

| `action`       | 結果狀態           | 理由                                                 |
| -------------- | ------------------ | ---------------------------------------------------- |
| `PROCEED`      | `REVIEW_COMPLETED` | 最新建議為「建議通過」時可省略，其餘必填（審核說明） |
| `REQUEST_INFO` | `AWAITING_INFO`    | 一律必填（補件內容）                                 |

成功回 `201`：

```json
{
  "caseNumber": "EXP-2026-003",
  "status": "REVIEW_COMPLETED",
  "action": {
    "action": "PROCEED",
    "actorType": "HUMAN",
    "actorLabel": "財務初審人員",
    "reason": "已核對額外交通費證明",
    "originalRecommendation": "MANUAL_REVIEW",
    "reviewKey": "REV-003-1",
    "resultingStatus": "REVIEW_COMPLETED",
    "createdAt": "2026-09-29T03:47:00.000Z"
  }
}
```

| 狀態碼 | 情況                                                         |
| ------ | ------------------------------------------------------------ |
| 400    | 請求格式錯誤；需要理由卻留白                                 |
| 404    | 找不到案件                                                   |
| 409    | `reviewKey` 不是最新審查紀錄；此審查紀錄已處理（含同時送出） |

處理紀錄保留原始建議，審查紀錄本身不改變。處理紀錄、處理進度與稽核事件在同一個交易內寫入。

## POST /api/cases/batch-complete

```json
{ "caseNumbers": ["EXP-2026-001"] }
```

整批皆須為「最新建議為建議通過且尚未處理」的案件，否則**整批不執行**。成功回 `200`：

```json
{ "results": [{ "caseNumber": "EXP-2026-001", "status": "REVIEW_COMPLETED" }] }
```

| 狀態碼 | 情況                               |
| ------ | ---------------------------------- |
| 400    | 空選取、案件重複                   |
| 404    | 任一案件不存在                     |
| 409    | 任一案件不是建議通過，或已經處理過 |

同一批的處理紀錄共用一個 `batchId`。

## GET /api/cases/:caseNumber/audit

```json
{
  "events": [
    {
      "seq": 1,
      "type": "CASE_CREATED",
      "actorType": "SYSTEM",
      "actorLabel": "system:preset-fixture",
      "payload": { "caseNumber": "EXP-2026-003" },
      "createdAt": "2026-09-21T01:00:00.000Z",
      "hash": "…"
    }
  ],
  "chainValid": true
}
```

事件類型：`CASE_CREATED`、`REVIEW_RECORDED`、`WORKFLOW_ACTION`。
`chainValid` 為重算 hash chain 的結果；序號缺號、前後 hash 不符或內容被改都會是 `false`。

## POST /api/cases/:caseNumber/readings

依 `specs/receipt-reading.md`，以 AI（目前為 Gemini）讀取案件所有憑證、擷取欄位，並以讀到的金額執行 E-01。
**不改變審查紀錄、檢查清單與處理進度。** 立刻回 `202`，讀取在背景進行：

```json
{ "readingId": "cmum…", "status": "RUNNING" }
```

| 狀態碼 | 情況                           |
| ------ | ------------------------------ |
| 400    | 案件沒有憑證                   |
| 404    | 找不到案件                     |
| 409    | 此案件已有讀取正在進行         |
| 500    | 找不到憑證圖檔（部署設定問題） |

沒有設定 `GEMINI_API_KEY` 不會回錯誤碼：讀取紀錄照常建立，結果為 `FAILED`，原因說明尚未設定金鑰。

## GET /api/cases/:caseNumber/readings

```json
{
  "readings": [
    {
      "id": "cmum…",
      "status": "SUCCEEDED",
      "startedAt": "2026-09-29T08:50:00.000Z",
      "finishedAt": "2026-09-29T08:50:03.000Z",
      "actorLabel": "財務初審人員",
      "provider": "gemini",
      "model": "gemini-3.8-flash",
      "promptVersion": "receipt-reading-v1",
      "receiptKeys": ["EV-003"],
      "extractions": {
        "EV-003": {
          "vendor": { "status": "RECOGNIZED", "value": "城際客運（模擬）" },
          "issueDate": { "status": "RECOGNIZED", "value": "2026-09-18" },
          "totalAmount": { "status": "RECOGNIZED", "value": "1480" },
          "currency": { "status": "RECOGNIZED", "value": "TWD" },
          "documentNumber": { "status": "RECOGNIZED", "value": "EV-003" },
          "taxId": { "status": "RECOGNIZED", "value": "00000000（示範值）" }
        }
      },
      "amountChecks": [
        {
          "lineKey": "EXP-2026-003",
          "result": {
            "status": "MISMATCH",
            "reason": "金額有差異，需由財務人員確認原因。",
            "applicationCents": 168000,
            "evidenceCents": 148000,
            "differenceCents": 20000,
            "rule": "E-01 v1"
          }
        }
      ],
      "failureReason": null
    }
  ]
}
```

- `status`：`RUNNING`（還沒有結果）／`SUCCEEDED`／`FAILED`。開始後超過 90 秒仍沒有結果（例如服務中斷），視為 `FAILED`。
- 欄位 `status`：`RECOGNIZED`（有值）／`UNREADABLE`／`NOT_ON_RECEIPT`（兩者皆無值）。
- 失敗時 `extractions` 與 `amountChecks` 為 `null`，不回傳部分結果；`failureReason` 可直接顯示。
- 模型的原始回應與用量保存在資料庫（`ReceiptReadingOutcome`），供回放與估算費用，不在此回傳。
