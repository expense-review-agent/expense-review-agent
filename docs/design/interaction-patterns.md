# Interaction Patterns

## 壹、核心原則

CheckMate 的互動設計必須讓使用者快速完成三件事：

1. 看懂 Agent 的結論。
2. 確認結論是否有足夠依據。
3. 採取正確的下一步。

互動順序採 **Outcome-first + Evidence-first**，不讓使用者先閱讀大量 AI 推理才知道結果。

## 貳、案件審查模式（Case Review Pattern）

案件詳情（Case Detail）建議流程：

案件摘要（Case Summary）→ 審查建議（Recommendation）→ 阻擋風險／風險訊號（Blocking / Risk Signal）→ 必要檢核（Required Checks）→ 發現項目（Finding）→ 佐證資料（Evidence）→ 流程動作（Action）→ 稽核紀錄（Audit Record）

審查建議必須在首屏可見。

若存在阻擋型問題（Blocking Issue），不應讓主要動作看起來仍可安全執行 PROCEED。

## 參、發現項目模式（Finding Pattern）

每個發現項目（Finding）至少回答：

- 發現什麼？
- 嚴重程度？
- 依據什麼佐證資料（Evidence）？
- 對應哪一條規則／來源（Rule / Source）？
- 對審查建議（Recommendation）有什麼影響？

避免把多個不同問題塞進一段 AI 摘要（Summary）。

## 肆、佐證資料模式（Evidence Pattern）

佐證資料（Evidence）應盡可能顯示：

- 原始值
- 資料來源
- 對應欄位
- 比對結果
- 必要時顯示原始文件位置

使用者應能從發現項目（Finding）回到佐證資料，而不是只能相信文字摘要。

## 伍、審查建議模式（Recommendation Pattern）

固定三種：

### 建議通過
必要檢查已完成，且沒有阻擋風險。不代表最終核准。

### 建議補件
缺少完成初審所需的資料或證據。必須明確說明「缺什麼」。

### 建議人工審核
存在高風險、不確定、規則衝突或需要專業判斷的情境。必須明確說明「為什麼需要人」。

## 陸、工作流程動作模式（Workflow Action Pattern）

審查建議與流程動作分開顯示。

### PROCEED
用於 Agent 初審已完成且符合自動推進條件。UI 文案應依情境使用「送往下一審核節點」「完成初審」等清楚動詞，避免讓使用者誤解為最終核准。

### REQUEST_INFO
用於缺件或資訊不足。操作前顯示需要補充的項目、通知對象與將執行的動作；執行後留下稽核紀錄（Audit Record）。

### ESCALATE
用於高風險、不確定或需人工專業判斷。清楚說明轉交原因、轉交對象／佇列（Queue）與 Agent 已完成哪些檢查。

### OVERRIDE
人工不同意 Agent 結果時使用。至少記錄原本的審查建議（Recommendation）、人工決策（Human Decision）、覆寫原因（Override Reason）與時間戳記（Timestamp）。

## 柒、自動執行控制模式（Automation Gate Pattern）

在允許 Agent 自動執行前，UI／系統狀態（System State）必須能反映：

- 必要檢核（Required Checks）是否完成
- 佐證資料（Evidence）是否充分
- 規則判斷結果是否明確
- 是否存在阻擋型風險（Blocking Risk）
- 是否存在未解決衝突
- 流程動作是否位於授權範圍

只要任一條件未滿足，自動執行即被阻擋。

不要用單一「AI 信心值（Confidence）」百分比取代上述控制條件。

## 捌、確認模式（Confirmation Pattern）

REQUEST_INFO、ESCALATE、OVERRIDE 與任何可能改變案件流程狀態的動作建議要求確認。

Confirmation 應寫清楚「即將發生什麼」，而不是只問「確定嗎？」

例如：

> 即將要求申請人補上住宿發票。送出後，案件會進入等待補件狀態。

## 玖、狀態文案（Status Wording）

建議：

- 待審查
- 審查中
- 待補件
- 待人工審核
- 初審完成
- 已轉交

避免：

- AI 思考中
- AI 不太確定
- 看起來沒問題
- 可能安全

## 拾、Loading / Empty / Error

### Loading
可顯示實際階段，例如正在整理案件資料、比對憑證、檢查規範或產生審查結果。

### Empty
說明沒有內容的原因，例如「此案件目前沒有需要人工處理的風險項目」。

### Error
明確說明錯誤是否影響資料讀取、某項檢查、審查建議（Recommendation）或流程動作（Action）。

## 拾壹、稽核紀錄模式（Audit Pattern）

稽核時間軸（Audit Timeline）以事件為單位，至少顯示：

- 時間
- 執行者（Actor）：Agent／人工（Human）／系統（System）
- 動作（Action）
- 結果（Result）
- 原因（Reason，如適用）

使用者應能重建案件從進入 CheckMate 到目前狀態的主要決策歷程。

## 拾貳、無障礙設計（Accessibility）

- 所有 Action 可由 Keyboard 操作。
- Drawer / Modal 開啟時正確移動 Focus。
- Status 具文字 Label。
- Error 與 Warning 不只用顏色表示。
- 展開／收合元件具有可辨識的 Accessible Name。
