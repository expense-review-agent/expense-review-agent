# Product Scope

> 本文件定義各階段做到哪裡，並提供推進順序；不是固定日期的交付承諾。Product Brief 保留長期方向，各 Feature Spec 定義已收斂的行為、User Flow 與 Edge Cases。文件是持續開發的 Source of Truth，不是 Demo Day 的硬性交付。

## 壹、本輪｜Expense Case Review Prototype

目標：讓產品負責人實際操作並 review 流程、資訊架構與核心畫面。先驗證「看懂初審結果、理解關鍵原因、查證依據」，不要求第一版完成原始題目所有能力。

- 布局：案件列表與右側詳情並排；開啟詳情時左側導覽自動收合。
- 以待處理／待補件／已完成初審／全部分流；完成操作後移出待處理並可查看結果。
- 案件編號與申請人分欄搜尋，初審建議可複選；列表每列僅代表一筆案件，包含費用摘要。建議通過檢視可勾選未處理案件，確認後模擬批次完成初審。
- 財務初審人員直接處理例外：以模擬確認對話框體驗完成初審、要求補件及記錄人工判斷。
- 六筆 Spec 代表案例，加上系統無法判斷及多筆費用缺件，全部為 Mock Data。
- 三種審查建議、四個檢查面向；具體異常與無法判斷需明確區分。
- 一筆案例預置兩次審查紀錄，可切換查看當時建議、發現與佐證快照；歷史紀錄禁止處理。
- 首屏顯示建議及關鍵原因，證據、規範、對照案件按需展開。
- 使用預置分析結果，於帳號「關於此展示」及處理確認畫面說明模擬範圍；不宣稱已完成 OCR、AI 分析引擎或實際流程處置。

本輪僅探索 Workflow Action 的前端操作，不包含實際通知／流程串接、上傳／欄位擷取、自動執行、獨立驗證、後端或正式權限。處理紀錄保留原始建議、人工說明、執行者與時間，重新整理即重設，不支援再次處理或補件回流。原始題目的讀取與擷取能力保留在下一階段。

驗證重點：使用者是否能理解建議、找到依據、辨別系統判斷邊界，以及理解重審差異。探索中的 UI 不強制先寫正式 Spec；review 收斂後再更新規格。可自動驗證的核心行為依 SDD／test-first 小步實作，不一次建立完整引擎。

## 貳、Demo Day｜逐步補齊的目標能力

先補齊原始題目要求的「模擬申請／單據 → 讀取及欄位擷取 → 實際初審 → 可追溯結果」。再逐步加入受控處置，展示正常案件可推進、風險案件被攔下且可查證。以下為目標範圍，不代表本輪需完成，也不代表皆為主辦方最低要求；每個新增 Slice 先確認產品行為與驗收條件。

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

## 參、候選能力｜核心流程成立後再評估

- 規範管理介面（Policy Management UI）
- 法規規則管理介面（Compliance Rule Management UI）
- 批次／影子稽核（Batch / Shadow Audit）
- 儀表板／摘要（Dashboard / Summary）
- 進階案件搜尋／篩選（日期、部門等）
- 規則版本（Rule Version）顯示
- 基本審查統計
- 更完整的稽核／決策歷程（Audit / Decision History）

上述能力不應阻塞核心 Demo Flow；精簡案件列表已納入 Prototype，編號／申請人搜尋與建議複選已納入本輪，進階條件仍屬候選能力。

## 肆、Concept｜後續方向

- 送出前驗證（Pre-submit Validation）
- 持續優化（Continuous Optimization）
- 進階風險智慧（Advanced Risk Intelligence）
- 企業系統整合（Enterprise Integration）
- 多法域法規遵循（Multi-jurisdiction Compliance）

## 伍、不在產品範圍（Out of Scope）

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

## 陸、Demo Day 目標正常路徑（Happy Path）

正常案件 → 開啟案件 → 查看 Agent 審查結果 → 查看發現項目（Finding）／佐證資料（Evidence） → 確認必要檢查完成 → 建議通過 → PROCEED → 留下處理紀錄

## 柒、Demo Day 目標例外路徑（Exception Paths）

### 缺件
缺少必要證據 → 建議補件 → REQUEST_INFO → 留下通知與處理紀錄

### 高風險／不確定
偵測異常或無法安全判斷 → 建議人工審核 → ESCALATE → 交由財務人員處理

### 人工覆寫
財務人員不同意 Agent 結果 → OVERRIDE → 記錄原因 → 保留人工決策（Human Decision）

## 捌、Demo Day 目標完成條件

Demo Day 目標能力完成時，評審或測試者應能清楚回答：

1. CheckMate 審了什麼？
2. 為什麼得出這個結果？
3. 哪些案件可以由 Agent 繼續處理？
4. 哪些案件一定會被攔下來交給人？
5. Agent 執行了什麼後續動作？
6. 人類如何覆寫與追溯決策？

## 玖、留待對應 Slice 確認

- 建議通過但無自動執行權限時的狀態與人工接手方式。
- 人工覆寫是否允許再次覆寫，以及後續流程動作銜接。
- 補件期限、催辦／升級機制、補件後重新分析範圍與狀態銜接；目前不實作逾期自動處理。
- 多個發現項目的排序與嚴重程度呈現，先透過 Prototype review 收斂。
- 獨立驗證及受控處置的授權條件。

金額不一致目前依 `specs/review-case.md` 一律建議人工審核，不再列為未決。全局共通原則放在 Product Brief，功能流程及例外放在對應 Spec，不另維護全局 User Flow／Edge Case 文件。

## 已實作的第一個分析子項

E-01 v1（依 `specs/amount-check.md`）已實作為純函式並有單元測試，支援單筆 TWD 申請與單一憑證總額的一致、不一致、缺件及無效輸入判斷。曾嘗試整合進單一案件的即時初審流程（待初審 → 開始初審 → 真算金額比對），但該案件在工作台列表中顯示「尚未開始初審」，會被誤認為系統錯誤，體驗上不成立，已於 Demo Day 準備階段移除；目前工作台共八筆案件，全部維持預置完整審查結果，E-01 v1 暫無使用者可見入口。OCR、資料輸入串接與四面向整合仍未完成。
