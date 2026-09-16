# review-api Specification

## Purpose

驅動 Reviewer 工作台的 M1 後端 HTTP API 介面——案件查詢、規範列表、非同步 Agent run、
Reviewer／主管動作、稽核軌跡取得——同時保持每個決定可追溯，且每個 Reviewer 動作都經
shared 合法動作矩陣驗證。

## Requirements

### Requirement: 案件列表與狀態統計

API SHALL 提供可依狀態篩選的案件列表，以及各狀態的案件計數統計。統計的計數 MUST 等於列表
在該狀態下回傳的案件數。

列表的每個項目 MUST 同時帶出 Agent 分類（沿用既有 `status` 欄位語意）與案件流程狀態
（`DRAFT / QUEUED / AWAITING_INFO / DISPOSED / REVIEW_CLOSED`），兩者為獨立欄位，不得互相替代。
新增流程狀態欄位 MUST NOT 改變既有欄位的值或語意。項目 MUST 帶出案件記錄的部門（未記錄時為無值），
以及案件的**申請日期**（未記錄時為無值）——列表以申請日期為日期欄並可依它排序。
既有的消費日期欄位 MUST 保留，MUST NOT 被申請日期取代。

API SHALL 另提供一個**只依案件流程狀態**篩選的參數，與既有的狀態篩選參數獨立。既有參數比對的是
「有 run 用 Agent 分類、無 run 用流程狀態」的合併值，因此 MUST NOT 用它篩選流程狀態——
帶有 Agent run 的案件會因分類覆蓋而篩不到。兩個參數同時給定時 MUST 以 AND 條件套用。
流程狀態篩選 MUST 能取回帶有 Agent run 的 `REVIEW_CLOSED` 案件。

#### Scenario: 依狀態篩選列表

- **WHEN** 用戶端以狀態 `NORMAL` 篩選請求案件列表
- **THEN** 只回傳狀態為 `NORMAL` 的案件

#### Scenario: 未篩選時回傳所有待審案件

- **WHEN** 用戶端未帶狀態篩選請求案件列表
- **THEN** 回傳所有待審案件

#### Scenario: 統計計數與列表一致

- **WHEN** 用戶端請求狀態統計
- **THEN** 每個狀態的計數等於列表在該狀態下回傳的案件數

#### Scenario: 列表項目帶出流程狀態

- **WHEN** 用戶端請求案件列表，其中某案件 Agent 分類為 `MISSING`、流程狀態為 `AWAITING_INFO`
- **THEN** 該項目的分類欄位為 `MISSING`，且流程狀態欄位為 `AWAITING_INFO`

#### Scenario: 無 run 的參照案件

- **WHEN** 列表包含一筆沒有 Agent run 的 `REVIEW_CLOSED` 參照案件
- **THEN** 該項目的流程狀態欄位為 `REVIEW_CLOSED`

#### Scenario: 依流程狀態篩選取回已結案案件

- **WHEN** 用戶端以流程狀態 `REVIEW_CLOSED` 篩選請求案件列表，且其中一筆已結案案件帶有 Agent 分類為 `NORMAL` 的 run
- **THEN** 回應包含該案件

#### Scenario: 兩個篩選參數同時套用

- **WHEN** 用戶端同時以 Agent 分類 `MISSING` 與流程狀態 `AWAITING_INFO` 篩選
- **THEN** 只回傳同時符合兩個條件的案件

#### Scenario: 列表項目帶出部門

- **WHEN** 用戶端請求案件列表，其中某案件記錄了部門
- **THEN** 該項目的部門欄位為該部門名稱；未記錄部門的案件其部門欄位為無值

#### Scenario: 列表項目帶出申請日期與消費日期

- **WHEN** 用戶端請求案件列表
- **THEN** 每個項目同時含申請日期與消費日期兩個欄位，兩者為獨立欄位

### Requirement: 含檢查、建議與規範引用的案件詳情

API SHALL 為單一案件回傳申請資訊、Agent 逐項檢查結果、建議動作，以及各檢查所依據的規範引用。
每個回傳的非通過檢查 MUST 至少含一筆證據。跨案件檢查（重複／拆單）MUST 含關聯案件參照。

詳情 MUST 同時帶出 Agent 分類與案件流程狀態，兩者為獨立欄位，讓用戶端可依流程狀態判斷案件
是否仍待 Reviewer 處置。申請資訊 MUST 帶出案件記錄的部門（未記錄時為無值）。

案件已有 Reviewer 處置紀錄時，詳情 MUST 帶出**最新一筆**處置的：執行人員顯示名稱、處置時間、
Reviewer 動作，以及該處置**寫入時固化**的一致性徽章。徽章 MUST 直接取自處置紀錄，
MUST NOT 於查詢時依當前 Agent 建議重算。案件沒有處置紀錄時，該欄位 MUST 為無值，
API MUST NOT 以 Agent 建議或任何預設值填補。處置紀錄為 append-only，
此需求 MUST NOT 造成對既有處置紀錄的修改。

#### Scenario: 詳情含檢查與建議

- **WHEN** 用戶端請求某案件的詳情
- **THEN** 回應含申請資訊、帶結果的檢查清單、建議動作，以及每個檢查的規範引用

#### Scenario: 非通過檢查附帶證據

- **WHEN** 回傳的某檢查為非通過結果
- **THEN** 它至少含一筆證據

#### Scenario: 不存在的案件 id

- **WHEN** 用戶端請求不存在的案件 id
- **THEN** API 以 404 not-found 錯誤回應

#### Scenario: 處置後詳情反映新的流程狀態

- **WHEN** 某案件的 Reviewer 處置被接受、結果狀態為 `DISPOSED`，之後用戶端請求該案件詳情
- **THEN** 詳情的流程狀態欄位為 `DISPOSED`，而 Agent 分類欄位維持原值

#### Scenario: 詳情帶出處置人與固化徽章

- **WHEN** 某案件已有一筆 Reviewer 處置，之後用戶端請求該案件詳情
- **THEN** 回應含該處置的執行人員顯示名稱、處置時間、Reviewer 動作，以及處置寫入時固化的一致性徽章

#### Scenario: 多次處置取最新一筆

- **WHEN** 某案件先後有兩筆處置紀錄
- **THEN** 詳情回傳時間較晚那一筆的處置人與徽章，且兩筆紀錄都未被修改

#### Scenario: 無處置紀錄時為無值

- **WHEN** 用戶端請求一筆流程狀態為 `QUEUED`、尚未被處置的案件詳情
- **THEN** 處置紀錄欄位為無值，回應不含任何處置人資訊

### Requirement: 規範列表

API SHALL 列出啟用中的費用規範，並可選擇依費用類別篩選。每條規範的識別碼 MUST 與案件詳情
檢查所引用的規則代碼一致。

#### Scenario: 列出規範

- **WHEN** 用戶端請求規範列表
- **THEN** 回傳啟用中的規範，各含其規則代碼、條文參照與條文原文

#### Scenario: 規範代碼與案件檢查一致

- **WHEN** 案件詳情的某檢查引用了某規則代碼
- **THEN** 規範列表中存在具相同代碼的規範

### Requirement: 非同步 Agent run

API SHALL 將 run 建立設計為非同步操作：建立 run 立即回傳 run 識別碼與 accepted 狀態，
run 狀態另行取得。run 建立契約 MUST NOT 要求呼叫端等待判定完成。

#### Scenario: 建立 run 立即回傳 run id

- **WHEN** 用戶端為某案件建立 run
- **THEN** API 以 HTTP 202 與 run 識別碼回應，不阻塞等待判定結果

#### Scenario: 輪詢 run 狀態

- **WHEN** 用戶端以識別碼請求某 run 的狀態
- **THEN** API 回傳當前 run 狀態（`PENDING`、`RUNNING`、`SUCCEEDED` 或 `FAILED`）

### Requirement: 以 shared 矩陣驗證的 Reviewer 處置

API SHALL 接受對案件的 Reviewer 處置，並 MUST 依該案件建議動作以 shared 合法動作矩陣驗證
該動作。非法動作 MUST 在任何狀態變更前被拒絕。需要理由的處置在理由缺漏時 MUST 被拒絕。
接受 `MANUAL_REVIEW` 建議 MUST 轉呈（escalate）而非記錄最終核准／否決。每個被接受的處置
MUST 附帶一筆稽核事件。

每個被接受的處置 MUST 記錄該次人工判斷的**最終結論**，其值由 Reviewer 實際採取的動作
決定，而非直接沿用 Agent 建議：採用建議時最終結論等於決策當下的 Agent 建議；退回補件時
為補件；人工判斷時取自請求所指定的最終結論；保留待處理時無最終結論。

人工判斷（`MANUAL_JUDGEMENT`）MUST 由請求明確指定最終結論，缺漏時 MUST 被拒絕；
其餘動作 MUST NOT 指定最終結論，指定時 MUST 被拒絕。

每個被接受的處置 MUST 依**決策當下的 Agent 建議**與**人工最終結論**計算一致性標記，
並將計算結果固化寫入該筆處置。一致性標記 MUST NOT 於顯示時重算。

#### Scenario: 非法動作被拒

- **WHEN** Reviewer 提交該案件建議動作所不允許的動作
- **THEN** API 以 400 錯誤回應，且無狀態變更

#### Scenario: 缺漏必填理由被拒

- **WHEN** Reviewer 提交需要理由的動作卻未提供理由
- **THEN** API 以 400 錯誤回應，且無狀態變更

#### Scenario: 被接受的處置記錄稽核事件

- **WHEN** 一個合法處置被接受
- **THEN** 案件的結果狀態被更新，且於同一 transaction 內記錄一筆 append-only 稽核事件

#### Scenario: 接受 MANUAL_REVIEW 會轉呈

- **WHEN** Reviewer 接受 `MANUAL_REVIEW` 建議
- **THEN** 案件轉呈主管，而非記錄最終核准／否決結論

#### Scenario: 人工判斷記錄人工指定的最終結論

- **WHEN** Reviewer 對建議為「通過」的案件提交人工判斷，並指定最終結論為「補件」
- **THEN** 該筆處置記錄的最終結論為「補件」，而非 Agent 原本建議的「通過」

#### Scenario: 人工判斷未指定最終結論被拒

- **WHEN** Reviewer 提交人工判斷卻未指定最終結論
- **THEN** API 以 400 錯誤回應，且無狀態變更

#### Scenario: 非人工判斷的動作指定最終結論被拒

- **WHEN** Reviewer 提交採用建議、退回補件或保留待處理，卻同時指定了最終結論
- **THEN** API 以 400 錯誤回應，且無狀態變更

#### Scenario: 採用建議時最終結論等於 Agent 建議

- **WHEN** Reviewer 採用 Agent 建議
- **THEN** 該筆處置記錄的最終結論等於決策當下的 Agent 建議，且一致性標記為「一致」

#### Scenario: 推翻 Agent 明確結論標記為覆寫

- **WHEN** Agent 建議為「通過」，Reviewer 以人工判斷指定最終結論為「補件」
- **THEN** 該筆處置的一致性標記為「覆寫」，且理由為必填

#### Scenario: Agent 未下結論而由人承擔判斷

- **WHEN** Agent 建議為「人工審核」，Reviewer 指定最終結論為「通過」或「補件」
- **THEN** 該筆處置的一致性標記為「人承擔判斷」，且理由為必填

#### Scenario: 保留待處理不記錄最終結論

- **WHEN** Reviewer 選擇保留待處理
- **THEN** 該筆處置無最終結論，一致性標記為「尚未決定」，案件留在待審

#### Scenario: 稽核軌跡可直接讀出人工結論

- **WHEN** 用戶端取得某案件的稽核軌跡
- **THEN** 處置事件的內容包含該次的人工最終結論與一致性標記，不需另行查詢處置紀錄

### Requirement: 主管稽核

API SHALL 接受對案件的主管稽核動作，並將其記錄為 append-only 事件並附帶稽核事件。
標記疑慮（concern）的動作在其意見（comment）缺漏時 MUST 被拒絕。

#### Scenario: 主管標記疑慮卻無意見

- **WHEN** 主管提交標記疑慮的動作卻未附意見
- **THEN** API 以 400 錯誤回應，且無狀態變更

#### Scenario: 主管動作記錄稽核事件

- **WHEN** 提交一個有效的主管稽核動作
- **THEN** 寫入一筆 append-only 主管稽核紀錄與一筆稽核事件

### Requirement: 附 chain 驗證的稽核軌跡取得

API SHALL 依序回傳案件的 append-only 稽核軌跡，並 MUST 回報稽核 hash chain 是否驗證通過
（未遭竄改）。

#### Scenario: 稽核軌跡依序回傳

- **WHEN** 用戶端請求某案件的稽核軌跡
- **THEN** 事件依其序號（sequence）排序回傳

#### Scenario: 回報 chain 驗證

- **WHEN** 用戶端請求某案件的稽核軌跡
- **THEN** 回應指出 hash chain 是否有效

### Requirement: 依申請人或部門查詢案件紀錄

API SHALL 提供依申請人或依部門取得案件紀錄的查詢，供用戶端呈現該申請人或該部門的歷史申請。
每筆結果 MUST 含案件編號、申請日期、金額與幣別、Agent 分類（若有 run）與案件流程狀態。
結果 MUST 依申請日期由新到舊排序，並 MUST 包含作為查詢起點的案件本身。

此查詢 SHALL 只回傳既有案件欄位的唯讀投影。回應 MUST NOT 含風險分數、頻率統計、跨案件風險判定
或任何結論性標記——跨案件風險判定不屬本階段範圍。

查詢 MUST 限定在同一組織範圍內。指定的申請人或部門查無任何案件時，API MUST 回傳空清單，
MUST NOT 以 404 表示。

#### Scenario: 依申請人查詢

- **WHEN** 用戶端以某申請人查詢案件紀錄
- **THEN** 回應含該申請人的案件清單，每筆帶案件編號、申請日期、金額、分類與流程狀態，依申請日期由新到舊排序

#### Scenario: 依部門查詢

- **WHEN** 用戶端以某部門查詢案件紀錄
- **THEN** 回應含該部門所有案件

#### Scenario: 含查詢起點案件

- **WHEN** 用戶端以案件 `EXP-2026-2002` 的申請人查詢
- **THEN** 回應包含 `EXP-2026-2002` 本身

#### Scenario: 不含風險判定

- **WHEN** 某申請人有多筆案件
- **THEN** 回應只含案件欄位，不含任何風險分數、頻率統計或結論性標記

#### Scenario: 查無紀錄回空清單

- **WHEN** 用戶端以一個沒有任何案件的部門查詢
- **THEN** API 回傳空清單，而非 404
