# 後端 API 規格（M1 DEMO 導向）

> 依 `PRD v0.1`（Reviewer 工作台）與 `Product Vision & Strategy` 設計，對齊 schema v3。
> **DEMO 導向**：判定可用簡化/寫死邏輯，只要能吐出 seed 案件的結果讓前端演一條龍即可。
> 作者：@ChichiTung（後端）｜日期：2026-09-08
>
> 慣例：REST + JSON；型別一律引用 `packages/shared`；金額以字串傳遞（避免浮點誤差）；
> 訊息走 `messageKey` + `messageParams`（DB 不存中文），前端用 i18n 組字。

## 對應 PRD 的 API 總表

| #   | Method | Path                               | 用途                           | 對應 PRD              |
| --- | ------ | ---------------------------------- | ------------------------------ | --------------------- |
| 1   | GET    | `/api/health`                      | 健康檢查                       | —                     |
| 2   | GET    | `/api/cases/summary`               | 四狀態統計卡片數字             | US-1 AC1.1/1.2        |
| 3   | GET    | `/api/cases?status=`               | 案件列表（可篩選）             | US-1 AC1.3~1.6        |
| 4   | GET    | `/api/cases/:id`                   | 單案完整詳情                   | US-2 全部             |
| 5   | GET    | `/api/cases/:id/related`           | 關聯案件（HUMAN/重複）         | US-3 AC3.7            |
| 6   | GET    | `/api/cases/:id/audit`             | 單案稽核軌跡                   | Vision 5.1            |
| 7   | GET    | `/api/policies?category=`          | 8 條費用規範                   | US-4 全部             |
| 8   | POST   | `/api/cases/:id/runs`              | 觸發/重跑 Agent 初審（非同步） | Vision M1 / CLAUDE.md |
| 9   | GET    | `/api/runs/:runId`                 | 查詢 run 狀態（前端輪詢）      | 同上                  |
| 10  | POST   | `/api/cases/:id/disposition`       | Reviewer 處置                  | US-5                  |
| 11  | POST   | `/api/cases/:id/supervisor-review` | 主管稽核                       | M1-U2                 |

> **DEMO 最小集**：前端演一條龍只需 **2,3,4,7,10**。其餘（runs/audit/supervisor）
> 是加分項，時間夠再做。8/9 的 run 非同步契約先定好型別即可，實作可最後補。

---

## 1. GET /api/health

健康檢查。回 `{ "status": "ok" }`。用來確認後端有起來、DB 連得上。

## 2. GET /api/cases/summary

**US-1 AC1.1/1.2** — 五張統計卡片的數字。

**回應 200**

```json
{
  "total": 5,
  "byStatus": { "NORMAL": 1, "MISSING": 1, "EXCEPTION": 1, "HUMAN": 1, "REVIEW_CLOSED": 1 }
}
```

> DEMO 備註：`SELECT status, count(*) FROM "ExpenseCase" GROUP BY status`。
> 卡片顯示 NORMAL/MISSING/EXCEPTION/HUMAN 四種 + 總數；REVIEW_CLOSED 為參照案件可不顯示。

## 3. GET /api/cases?status=NORMAL

**US-1 AC1.3~1.6** — 案件列表，`status` 可選（不帶=全部）。

**回應 200**

```json
{
  "items": [
    {
      "id": "clx...",
      "caseNumber": "EXP-2026-2001",
      "applicantName": "王小明",
      "summary": "辦公用品採購",
      "category": "辦公用品",
      "amount": "1200.00",
      "currency": "TWD",
      "expenseDate": "2026-08-10",
      "status": "NORMAL",
      "recommendedAction": "APPROVE"
    }
  ]
}
```

> DEMO 備註：`recommendedAction` 取該案 currentRun 的值。EXCEPTION 案件前端會把金額標紅
> （AC1.6）——後端只需照實回傳，顏色是前端的事。

## 4. GET /api/cases/:id

**US-2 全部** — 單案完整詳情（詳情面板一次要的所有資料）。

**回應 200**

```json
{
  "id": "clx...",
  "caseNumber": "EXP-2026-2002",
  "summary": "餐費",
  "status": "EXCEPTION",
  "applicant": {
    "name": "李美華",
    "department": "業務一部",
    "amount": "3500.00",
    "category": "餐費",
    "expenseDate": "2026-08-05",
    "applicationDate": "2026-08-20"
  },
  "run": {
    "runId": "clr...",
    "classification": "EXCEPTION",
    "recommendedAction": "MANUAL_REVIEW",
    "confidenceLevel": "HIGH",
    "policyVersion": "v0.1",
    "engineVersion": "m1-review-engine@0.1.0"
  },
  "checks": [
    {
      "checkKey": "R7-duplicate",
      "ruleCode": "R7",
      "outcome": "FAIL",
      "isSuspicionOnly": true,
      "severity": "HIGH",
      "messageKey": "rule.R7.FAIL",
      "messageParams": { "ref": "EXP-2026-1043" },
      "policyRef": "§3.4",
      "policyText": "同單號＋同額＋同日 視為疑似重複",
      "evidence": [
        {
          "snippet": "單號 INV-2026-0805-77、金額 3,500、日期 2026-08-05 三者皆與已結案案件相同。",
          "relatedCaseId": "clx...ref",
          "relatedCaseNumber": "EXP-2026-1043"
        }
      ]
    }
  ],
  "suggestion": {
    "recommendedAction": "MANUAL_REVIEW",
    "reasonKey": "suggestion.EXCEPTION.R7",
    "reasonParams": { "ref": "EXP-2026-1043" }
  }
}
```

> DEMO 備註：這支是詳情面板的核心。`checks` 對應 PRD「Agent 檢查結果逐項 Checklist」，
> `suggestion` 對應「Agent 建議」。**注意 UI 定調**：前端只渲染人看得懂的結論
> （outcome 轉成 ✅/❌/⚠️、理由白話），**不渲染** DepChip/信心度/五態 tag（那些留在稽核層）。
> MISSING 案件另附 `noticePreview`（補件通知預覽，US-2 補件區塊）；
> HUMAN 案件另附 `humanAnalysis`（三段式：已完成/無法確定/建議）。

## 5. GET /api/cases/:id/related

**US-3 AC3.7** — HUMAN（拆單）/ EXCEPTION（重複）案件的關聯案件。

**回應 200**

```json
{
  "related": [
    {
      "id": "clx...",
      "caseNumber": "EXP-2026-1043",
      "amount": "3500.00",
      "status": "REVIEW_CLOSED"
    }
  ]
}
```

## 6. GET /api/cases/:id/audit

**Vision 5.1「追得回」** — 單案稽核軌跡（append-only、hash chain）。

**回應 200**

```json
{
  "events": [
    { "seq": 1, "type": "CASE_CREATED", "actorLabel": "system", "createdAt": "...", "hash": "..." },
    {
      "seq": 2,
      "type": "RUN_COMPLETED",
      "payload": { "classification": "EXCEPTION" },
      "createdAt": "...",
      "hash": "..."
    }
  ],
  "chainValid": true
}
```

> DEMO 備註：`chainValid` 重算 hash chain 驗證未被竄改——這正是 demo 的稽核亮點。

## 7. GET /api/policies?category=餐費

**US-4 全部** — 8 條費用規範，`category` 可選。

**回應 200**

```json
{
  "items": [
    {
      "ruleKey": "R1-lodging",
      "ruleCode": "R1",
      "name": "住宿費上限",
      "clauseRef": "§4.2",
      "clauseText": "住宿每晚上限 NT$4,000",
      "category": "住宿費",
      "params": { "limit": "4000" },
      "violationHandling": "超過需副總核准"
    }
  ]
}
```

> DEMO 備註：對應 PRD 費用規範頁。`ruleKey`/`ruleCode` 必須與案件詳情的 `checks[].ruleCode`
> 一致（US-4 AC4.5）。

## 8. POST /api/cases/:id/runs

**Vision M1 / CLAUDE.md** — 觸發（或重跑）Agent 初審。**非同步契約**：立刻回 202 + runId，
前端輪詢 #9 取狀態。（此設計是為了 Phase 2 接 OCR 時不改 API 契約。）

**回應 202**

```json
{ "runId": "clr...", "status": "PENDING" }
```

> DEMO 備註：M1 是同步純運算，但 **API 仍要設計成非同步**（CLAUDE.md 規定）。
> DEMO 可先「建立 run → 立刻算完 → 回 202」，前端輪詢一次就看到 SUCCEEDED。
> 判定邏輯可簡化/寫死到能吐出 seed 案件的結果即可，不需完整規則引擎。

## 9. GET /api/runs/:runId

查詢 run 狀態（前端輪詢）。

**回應 200**

```json
{ "runId": "clr...", "status": "SUCCEEDED", "caseId": "clx...", "classification": "EXCEPTION" }
```

> `status`: `PENDING | RUNNING | SUCCEEDED | FAILED`。前端輪詢到 SUCCEEDED 就去打 #4 取詳情。

## 10. POST /api/cases/:id/disposition

**US-5** — Reviewer 處置。動作合法性用 `packages/shared` 的 disposition 矩陣驗證。

**請求**

```json
{
  "runId": "clr...",
  "action": "MANUAL_JUDGEMENT",
  "finalAction": "REQUEST_INFO",
  "reason": "（覆寫或人工判斷時必填）"
}
```

`action`: `ACCEPT | REQUEST_INFO | MANUAL_JUDGEMENT | HOLD`（見 shared/disposition.ts）。

`finalAction`: `APPROVE | REQUEST_INFO | MANUAL_REVIEW`，**人工最終結論**。
**只有 `MANUAL_JUDGEMENT` 可以帶，且必填**（由 UI modal 指定通過／補件／人工審核）；
其餘動作**帶了就回 400**——結論由動作本身決定，靜默忽略會讓前端誤以為自己指定的值生效了。

各動作寫入 DB 的 `finalAction`：

| action             | 寫入的 finalAction     | 一致性徽章（範例：agent 建議 APPROVE）      |
| ------------------ | ---------------------- | ------------------------------------------- |
| `ACCEPT`           | 決策當下的 Agent 建議  | `CONSISTENT`                                |
| `REQUEST_INFO`     | `REQUEST_INFO`         | `OVERRIDDEN`（理由必填）                    |
| `MANUAL_JUDGEMENT` | 請求帶的 `finalAction` | 依算式，多為 `OVERRIDDEN` / `HUMAN_ASSUMED` |
| `HOLD`             | `null`（尚未下結論）   | `PENDING_DECISION`（理由非必填）            |

**回應 201**

```json
{ "dispositionId": "cld...", "resultingStatus": "DISPOSED", "consistencyFlag": "CONSISTENT" }
```

> DEMO 備註：**必須**用 `resolveDisposition(recommendation, action)` 驗證合法性——非法動作回 400。
> 寫入 Disposition（append-only）+ 一筆 AuditEvent。`MANUAL_REVIEW+ACCEPT` 要 escalate（見矩陣）；
> `MANUAL_REVIEW+MANUAL_JUDGEMENT` **不** escalate（人已下結論，由人承擔）。
> 徽章一律用 shared 的 `deriveConsistencyFlag(agentActionAtDecision, finalAction)` 算，
> **api 不得自行實作算式**。`reason` 在 OVERRIDDEN/HUMAN_ASSUMED 時必填，否則 DB CHECK 會擋
> （回 400 而非讓 DB 報 500）。AuditEvent payload 會帶 `finalAction` 與 `consistencyFlag`，
> 稽核頁不必回查 Disposition 表。

## 11. POST /api/cases/:id/supervisor-review

**M1-U2** — 主管稽核動作（加分項，DEMO 時間夠再做）。

**請求**

```json
{ "action": "APPROVE", "comment": "（FLAG_CONCERN 時必填）" }
```

`action`: `APPROVE | RETURN_TO_REVIEWER | MARK_REVIEWED | FLAG_CONCERN | ANNOTATE`。

**回應 201**：寫入 SupervisorReview（append-only）+ AuditEvent。RETURN_TO_REVIEWER 一律回 QUEUED。

---

## 實作建議（NestJS 模組切分，對應 CODEOWNERS）

全部放 `apps/api/src/review/`（你的地盤）。建議模組：

- `cases/`（controller + service）：#2~#6, #10
- `policies/`：#7
- `runs/`：#8, #9（judge 邏輯 DEMO 可先寫死映射 seed 案件）
- `common/`：Prisma module、health（#1）、disposition 驗證（import shared）

**開發順序（配合 3.2 逐日）**：

1. 9/9 先把上面 #3/#4/#7/#10 的**回應型別**放進 `packages/shared`（前端才能平行開工）。
2. 9/10 做 #1/#2/#3/#7（唯讀查詢，最快讓前端有資料）。
3. 9/11 做 #4/#5（詳情面板核心）。
4. 9/12~9/13 做 #10（處置）+ #8/#9（run）。
5. #6/#11 有空再做。

**DEMO 級簡化原則**：judge 邏輯不用寫完整規則引擎——因為 seed 案件的判定結果已經寫在 seed 裡，
`POST /runs` 可以「讀 seed 已算好的 run 結果」或「用簡單 if/else 映射」即可。重點是 API 契約
與前端對接順暢，不是判定引擎的完整性。
