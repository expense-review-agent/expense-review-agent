---
name: demo-case
description: 新增或修改費用初審的 demo 模擬案件（seed 資料）。當任務提到新增測試案件、mock case、demo 資料、seed、要展示某種規則觸發情境、或 demo 前需要重置資料時使用。涵蓋案件設計、四分類覆蓋、跨案件規則的成對設計與資料重置流程。
---

# 新增或修改 demo 案件

demo 案件是這個專案的第二份規格——它們決定了 demo 當天能不能演出來。
所有資料都是模擬的，**不得使用真實發票號碼、個資、供應商帳務或未經授權的財務文件**。

## 現有案件必須覆蓋的情境

命題最低要求：至少各一筆正常、重複申報、超額、缺件、金額不一致。
PRD 額外要求覆蓋四分類與 Tier 1 亮點。動 seed 前先確認不會弄丟覆蓋度：

| 情境             | 分類      | 展示重點                     |
| ---------------- | --------- | ---------------------------- |
| 一般辦公用品     | NORMAL    | 規則全通過、比對一致         |
| 重複申報         | EXCEPTION | R7，證據指向另一筆已結案案件 |
| 住宿超額         | EXCEPTION | R1，引用條文與差額           |
| 大額缺合約與核准 | MISSING   | R3 + R4，一次列全缺口        |
| 金額不一致       | EXCEPTION | R5 不符 + 雙假設評估         |
| 疑似拆單         | EXCEPTION | R8，跨案件、僅標「疑似」     |
| 多憑證加總差額   | EXCEPTION | R10，Tier 1 亮點             |
| 國外 invoice     | HUMAN     | Agent 主動退讓（ABSTAIN）    |
| 買方統編不符     | MISSING   | R9，請申請人換開發票         |
| 未匹配單據       | HUMAN     | 合併檔內有單據對不上申報項目 |

## 設計一筆案件

位置：`apps/api/prisma/seed/cases.ts`

### 1. 先決定要觸發什麼，再倒推資料

不要先編資料再看跑出什麼。先寫下「這筆要展示 Rxx 的 FAIL」，
再倒推需要的欄位值與 Policy 參數。跑完 seed 後**必須實際確認分類結果符合預期**，
不符合就是資料設計錯了或規則有 bug，兩者都要查。

### 2. 跨案件規則要成對設計

R7（重複申報）與 R8（疑似拆單）需要比對其他案件，**單獨一筆案件永遠不會觸發**。

- 重複申報：需要一筆「已結案」的參照案件，單號、金額、日期三者相同
- 疑似拆單：需要同申請人、同店家、時間窗內的多筆，各自低於核准門檻但加總超過

參照案件也要建進 seed，狀態設為 `REVIEW_CLOSED`，且不應出現在待審佇列的預設篩選中。

### 3. 信心值要刻意設計

Phase 1 沒有 OCR，信心值是 fixture 直接給的。這代表 **AC11（低信心不判 NORMAL）
如果沒有一筆刻意設低信心的案件，就完全沒被驗證過**。
至少要有一筆關鍵欄位 `confidenceLevel = LOW` 或 `NONE`、`isRecognized = false`。

### 4. Evidence 的 anchor

Phase 1 可以為 null，但如果要展示「點擊證據跳到單據上的位置」，
至少挑兩三筆手工標上 `{ page, bbox }`。這是 demo 說服力最高的細節之一。

### 5. 檔案

案件需要對應的 `StoredFile`。Phase 1 用 `apps/api/prisma/seed/assets/`
底下的模擬單據圖檔，seed 時上傳到 MinIO。
圖檔上必須有明顯的「模擬資料」浮水印或標示。

## 資料重置

demo 前一鍵回到乾淨狀態：

```bash
pnpm --filter api db:reset   # DROP SCHEMA + migrate + seed
```

**不要用 `TRUNCATE` 或逐表 DELETE。**
append-only 的表有 DB trigger 擋 DELETE，會失敗；
而且 `AuditEvent` 的 hash chain 需要從頭重建才會一致。
`db:reset` 腳本走的是 drop schema 重建，語意乾淨。

執行 seed 時同一批案件的 `caseNumber` 必須穩定不變，
否則 demo 腳本裡寫死的案件編號會失效。

## 檢查清單

- [ ] 十種情境的覆蓋度沒有變少
- [ ] 跨案件規則有成對的參照案件
- [ ] 至少一筆低信心／無法辨識的欄位
- [ ] 跑完 seed 後實際確認每筆的分類與建議符合預期
- [ ] 單據圖檔標示為模擬資料，無真實發票號碼或個資
- [ ] `pnpm --filter api db:reset` 可重複執行且結果一致
