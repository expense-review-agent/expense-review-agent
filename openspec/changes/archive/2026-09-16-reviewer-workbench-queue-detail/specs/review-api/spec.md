## MODIFIED Requirements

### Requirement: 案件列表與狀態統計

API SHALL 提供可依狀態篩選的案件列表，以及各狀態的案件計數統計。統計的計數 MUST 等於列表
在該狀態下回傳的案件數。

列表的每個項目 MUST 同時帶出 Agent 分類（沿用既有 `status` 欄位語意）與案件流程狀態
（`DRAFT / QUEUED / AWAITING_INFO / DISPOSED / REVIEW_CLOSED`），兩者為獨立欄位，不得互相替代。
新增流程狀態欄位 MUST NOT 改變既有欄位的值或語意。

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

### Requirement: 含檢查、建議與規範引用的案件詳情

API SHALL 為單一案件回傳申請資訊、Agent 逐項檢查結果、建議動作，以及各檢查所依據的規範引用。
每個回傳的非通過檢查 MUST 至少含一筆證據。跨案件檢查（重複／拆單）MUST 含關聯案件參照。

詳情 MUST 同時帶出 Agent 分類與案件流程狀態，兩者為獨立欄位，讓用戶端可依流程狀態判斷案件
是否仍待 Reviewer 處置。

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
