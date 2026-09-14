## MODIFIED Requirements

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
