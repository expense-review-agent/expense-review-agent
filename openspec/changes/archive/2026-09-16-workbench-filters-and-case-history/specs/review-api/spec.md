## MODIFIED Requirements

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

## ADDED Requirements

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
