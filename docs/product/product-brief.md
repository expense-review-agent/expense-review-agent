# Product Brief

## 壹、產品主張（Product Thesis）

**CheckMate is an AI Expense Review & Control Agent for corporate expense review.**

CheckMate 不只協助財務人員「看懂」費用案件，而是將企業規範、證據、風險判斷與工作流程控制整合成一個可受控執行的 AI 審查層。

核心目標：

> 在可管理的風險範圍內，讓更多費用案件能由 Agent 完成完整初審與必要處置，讓財務人員專注在真正需要專業判斷的例外案件。

## 貳、使用者對象（Target Users）

### 主要使用者（Primary User）
財務／會計初審人員

### 決策者（Decision Maker）
財務主管、會計主管、CFO

### 關鍵利害關係人（Key Stakeholders）
IT／資訊安全、內部稽核、風險管理、既有流程負責人（Workflow Owner）

## 參、問題（Problem）

現有費用審查常見兩個極端：

1. **大量人工逐筆檢查**：耗費人力，且時間花在重複比對、通知與轉交。
2. **單純規則自動化**：能抓明確違規，卻難處理脈絡、合理性與規則之外的風險。

生成式 AI 可以補足判斷能力，但若直接讓模型自主執行，又會帶來不可預期、難追溯與錯誤放大的風險。

CheckMate 要解的是：

> 如何把 AI 的判斷能力放進一套可控制、可追溯、可逐步授權的審查系統中。

## 肆、核心價值（Core Value）

### 1. 代理式審查
從「提供建議」進一步到「完成工作」。在企業授權範圍內，Agent 可執行通知補件、轉交人工、推進流程與紀錄等重複性處置。

### 2. 找出規則之外的風險
除了企業規範（Policy）與欄位比對，也辨識合理性、憑證真偽風險、歷史異常、重複／拆單與跨系統風險訊號。

### 3. 用決策資料持續改善制度
持續保留 Agent 的發現項目（Finding）、人工決策（Human Decision）、覆寫（Override）與最終結果（Final Outcome），協助企業調整規範、流程與自動化邊界。

### 4. 低門檻快速導入
作為既有 ERP、BPM、費用管理與會計流程之上的審查與控制層（Review & Control Layer），可由檔案、批次或 API 逐步導入。

## 伍、產品模型（Product Model）

CheckMate 的核心循環：

理解（Understand）→ 決策（Decide）→ 執行（Act）→ 觀察結果（Observe Outcome）→ 持續改善（Improve）

### 審查引擎（Review Engine）
- 資料擷取（Ingestion & Extraction）
- 資料正規化（Data Normalization）
- 佐證比對（Evidence Matching）
- 審查流程協調（Review Orchestration）
- 審查建議／流程動作（Recommendation / Action）
- 稽核軌跡（Audit Trail）

### 審查模組（Review Modules）
- 企業規範（Corporate Policy）
- 法規遵循套件（Jurisdiction Compliance Pack）
- 真偽／舞弊風險訊號（Authenticity / Fraud Signal）
- 情境風險（Contextual Risk）

### 系統整合（Integration）
- 檔案／批次（File / Batch）
- ERP／BPM／費用管理系統（Expense System）
- 企業卡（Corporate Card）
- 會計／應付帳款（Accounting / AP）

## 陸、審查建議與流程動作（Recommendation & Action）

### 審查建議（Recommendation）
CheckMate 對案件只產生三種審查建議：

- 建議通過
- 建議補件
- 建議人工審核

### 工作流程動作（Workflow Action）
審查建議與流程動作分離：

- **PROCEED**：初審完成，推進至既有流程下一節點
- **REQUEST_INFO**：要求補件或補充資訊
- **ESCALATE**：轉交人工審查
- **OVERRIDE**：人工覆寫 Agent 結果

「建議通過」不代表最終核准。

## 柒、控制模型（Control Model）

CheckMate 不以模型判斷本身作為自動執行依據。

只有同時符合以下條件，Agent 才能執行動作：

- 必要檢查完成
- 證據充分
- 規則明確
- 無阻擋風險
- 無未解決衝突
- 位於企業授權範圍內

控制設計包含：

1. 必要檢核（Required Checks）
2. 強制防護機制（Hard Guardrails）
3. 獨立驗證（Independent Verification）
4. 佐證鏈（Evidence Chain）
5. 漸進式自動化（Progressive Automation）
6. 執行後監控（Post-action Monitoring）

目前 Demo 優先呈現前四項；漸進式自動化與執行後監控作為後續能力。

## 捌、產品邊界（Product Boundary）

CheckMate 是**審查與控制層（Review & Control Layer）**，不是正式記錄系統（System of Record）。

既有 ERP、BPM、費用管理系統（Expense System）或會計系統（Accounting System）繼續保存正式交易與流程資料。

CheckMate 不負責：

- 最終核准
- 正式會計入帳
- 自動付款
- 正式稅務申報
- 最終稅務認定
- 舞弊或偽造的最終法律判定

## 玖、差異化假設（Differentiation Hypothesis）

CheckMate 的差異化假設不是「AI 可以看單據」，而是四個能力組合：

1. Agent 能在控制條件下直接完成部分工作。
2. 能辨識企業規則之外的脈絡與風險。
3. 每個結果都有佐證鏈（Evidence Chain）與完整稽核軌跡（Audit Trail）。
4. 不要求企業替換既有核心系統即可逐步導入。

這些仍是產品假設，需要透過客戶訪談、原型（Prototype）與實際案件驗證。

## 拾、成功定義（Success Definition）

目前不以虛構 ROI、模型準確率或建議採用率宣稱成功。

本階段成功定義為：

> 在既定風險邊界內，CheckMate 能讓更多代表性費用案件完成完整、可解釋且可操作的初審流程，並正確將不確定與高風險案件留給人工處理。
