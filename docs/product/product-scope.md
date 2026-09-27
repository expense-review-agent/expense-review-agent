# Product Scope

> 本文件定義目前版本要做、暫不做與只作為後續方向的能力。Product Brief 決定方向；Product Scope 決定這次做到哪裡。

## 壹、P0｜Demo 必須成立

### 1. 輸入與擷取（Input & Extraction）
- 支援模擬費用申請與單據資料
- 呈現關鍵欄位與來源
- 可識別缺漏資訊

### 2. 佐證比對（Evidence Matching）
- 比對申請與憑證
- 顯示一致、不一致與缺失項目
- 發現項目（Finding）可追溯至佐證資料（Evidence）

### 3. 企業規範審查（Corporate Policy Review）
以 5–8 條模擬規範（Mock Policy）展示金額上限、必要附件、可報支類別、期間／日期條件等可明確判斷的規則（Deterministic Rule）。

### 4. 台灣法規遵循（Taiwan Compliance）
選擇 1–2 條具代表性且可明確判斷的台灣規則，展示規則來源、適用條件、必要事實（Required Facts）、必要佐證（Required Evidence）與判斷結果。

無法明確判斷時轉人工。不建立完整台灣法規知識庫。

### 5. 風險訊號（Risk Signals）
至少可呈現部分：

- 合理性風險
- 重複申報
- 疑似拆單
- 憑證真偽風險訊號
- 歷史異常

進階風險可使用模擬訊號（Mock Signal）模擬，不宣稱已具備 Production 等級的偵測能力。

### 6. 審查建議（Recommendation）
僅有三種：

- 建議通過
- 建議補件
- 建議人工審核

每項審查建議都要清楚呈現主要理由。

### 7. 工作流程動作（Workflow Action）
審查建議與流程動作分離：

- PROCEED
- REQUEST_INFO
- ESCALATE
- OVERRIDE

Demo 中需讓使用者看見 Agent「不只判斷，也能完成後續處置」。

### 8. 控制機制（Control Mechanism）
至少展示：

- 必要檢核（Required Checks）
- 強制防護機制（Hard Guardrails）
- 佐證鏈（Evidence Chain）
- 獨立驗證（Independent Verification）的概念

不符合自動執行條件時，不得直接執行 PROCEED。

### 9. 稽核軌跡（Audit Trail）
保留：

- Agent 的發現項目（Finding）
- 審查建議（Recommendation）
- 流程動作（Action）
- 人工覆寫（Override）
- 時間與處理狀態

### 10. 示範案例（Demo Cases）
至少 5–10 筆模擬案例（Mock Cases），涵蓋：

- 正常案件
- 重複申報
- 超出費用上限
- 缺少必要附件
- 金額不一致

可額外加入合理性（Reasonableness）、真偽風險（Authenticity）、台灣法規遵循（Taiwan Compliance）等情境。

## 貳、P1｜核心流程成立後再補

- 規範管理介面（Policy Management UI）
- 法規規則管理介面（Compliance Rule Management UI）
- 批次／影子稽核（Batch / Shadow Audit）
- 儀表板／摘要（Dashboard / Summary）
- 案件搜尋／篩選（Case Search / Filter）
- 規則版本（Rule Version）顯示
- 基本審查統計
- 更完整的稽核／決策歷程（Audit / Decision History）

P1 不應阻塞核心 Demo Flow。

## 參、Concept｜後續方向

- 送出前驗證（Pre-submit Validation）
- 持續優化（Continuous Optimization）
- 進階風險智慧（Advanced Risk Intelligence）
- 企業系統整合（Enterprise Integration）
- 多法域法規遵循（Multi-jurisdiction Compliance）

## 肆、不在產品範圍（Out of Scope）

目前不做：

- 完整費用申請 Portal
- 完整員工補件對話流程
- 最終核准
- 正式會計入帳
- 自動付款
- 正式稅務申報
- 完整台灣法規知識庫
- 多國法規完整支援
- 真實企業系統正式串接
- Production Auth / RBAC
- Production-grade Security / Privacy / Data Retention
- 完整 Observability / Retry / Idempotency
- 真實 OCR／LLM Pipeline 的 Productionization

## 伍、Demo 正常路徑（Happy Path）

正常案件 → 開啟案件 → 查看 Agent 審查結果 → 查看發現項目（Finding）／佐證資料（Evidence） → 確認必要檢查完成 → 建議通過 → PROCEED → 留下處理紀錄

## 陸、Demo 例外路徑（Exception Paths）

### 缺件
缺少必要證據 → 建議補件 → REQUEST_INFO → 留下通知與處理紀錄

### 高風險／不確定
偵測異常或無法安全判斷 → 建議人工審核 → ESCALATE → 交由財務人員處理

### 人工覆寫
財務人員不同意 Agent 結果 → OVERRIDE → 記錄原因 → 保留人工決策（Human Decision）

## 柒、完成條件

本版本完成時，評審或測試者應能清楚回答：

1. CheckMate 審了什麼？
2. 為什麼得出這個結果？
3. 哪些案件可以由 Agent 繼續處理？
4. 哪些案件一定會被攔下來交給人？
5. Agent 執行了什麼後續動作？
6. 人類如何覆寫與追溯決策？
