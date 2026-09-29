# Design System

## 壹、設計方向（Design Direction）

**現代企業審查工作空間（Modern Enterprise Review Workspace）**

CheckMate 的介面應呈現專業、可信任、冷靜、高效率的企業級工作環境。

AI 是能力來源之一，但不應成為視覺主角。畫面應優先幫助使用者完成「審查、判斷、處置」。

## 貳、設計原則（Design Principles）

### 1. 結果優先（Review-first）
優先回答：這筆需要我處理嗎？為什麼？下一步是什麼？

### 2. 風險優先（Risk-first）
缺件、衝突、不確定與高風險訊號必須清楚可見。避免整頁使用紅／黃／綠造成視覺噪音。

### 3. 佐證先於說明（Evidence before explanation）
呈現順序：發現項目（Finding）→ 佐證資料（Evidence）→ 規則／來源（Rule / Source）→ 推理（Reasoning）。

不要用一大段 AI 說明取代具體證據。

### 4. 漸進式揭露（Progressive Disclosure）
第一層顯示決策所需資訊，詳細證據、規則與推理可逐步展開。

### 5. 一致的操作（Consistent Actions）
PROCEED、REQUEST_INFO、ESCALATE、OVERRIDE 在不同畫面保持一致的名稱、位置邏輯、視覺層級與確認方式。

## 參、資訊層級（Information Hierarchy）

案件詳情（Case Detail）建議資訊順序：

1. 案件摘要（Case Summary）
2. 審查建議（Recommendation）
3. 阻擋風險／風險訊號（Blocking / Risk Signals）
4. 必要檢核（Required Checks）
5. 發現項目（Finding）
6. 佐證資料（Evidence）
7. 工作流程動作（Workflow Action）
8. 稽核時間軸（Audit Timeline）

## 肆、版面配置（Layout）

- Desktop-first：主要 Demo 以 1280–1440px 為優先。
- 採 8px 間距系統（Spacing System）。
- 常用間距：4 / 8 / 16 / 24 / 32 / 48px。
- 避免審查資訊橫跨整個螢幕；詳細 Evidence 可使用 Side Panel、Drawer 或 Secondary Column。

## 伍、字體排印（Typography）

建議層級：

- Page Title：24–28px / Semibold
- Section Title：18–20px / Semibold
- Card Title：16px / Semibold
- Body：14–16px / Regular
- Metadata：12–14px / Regular

避免過多字重與尺寸。數字、金額、日期與 Case ID 應具有良好掃讀性。

## 陸、色彩（Color）

以中性色作為主要工作介面基底。

語意色彩（Semantic Color）僅用於成功（Success）、警告（Warning）、錯誤（Error）、提示（Information）、選取／可互動（Selected / Interactive）。

原則：

- 不用顏色作為唯一資訊來源。
- Blocking Risk 與一般 Warning 要有明確層級差異。
- AI 產生內容不使用專屬「AI 紫色」。

## 柒、核心元件（Core Components）

優先建立並重複使用：

- App Shell / Navigation
- Case Table
- Status Badge
- Recommendation Card
- Finding Card
- Evidence Item
- Required Check
- Risk Signal
- Rule / Source Reference
- Action Bar
- Confirmation Dialog
- Side Panel / Drawer
- Audit Timeline
- Empty / Loading / Error State

## 捌、動作階層（Action Hierarchy）

主要動作必須反映目前真正可執行的下一步。

Override 或可能改變流程狀態的操作需要額外確認。

動作文案（Action Wording）使用明確動詞，能精準描述行為時避免只用 OK、Submit、Continue。

## 玖、圖示（Icon）

- 使用一致的圖示庫（Icon Library），目前採用 Lucide React。
- 不使用 Emoji 作為 UI 圖示。
- 圖示不單獨承擔重要語意。
- 風險／狀態圖示需搭配文字標籤（Label）。

## 拾、UX 文案（UX Writing）

採台灣企業軟體常用語氣：簡潔、直接、專業、可操作，不誇大 AI 能力。

**建議**
> 缺少住宿發票，無法完成此項檢查。

**避免**
> AI 發現這筆案件似乎可能有一些問題，建議您再確認看看。

**建議**
> 已轉交人工審核。

**避免**
> 交給專業的人類同事處理吧！

## 拾壹、系統狀態（System States）

### Loading
說明正在進行的工作，例如「正在比對憑證」。

### Empty
說明目前沒有資料的原因與下一步。

### Error
說明發生什麼、是否影響審查，以及使用者可以怎麼處理。

### Success
確認實際完成的動作，不使用空泛成功訊息。

## 拾貳、無障礙設計（Accessibility）

以 WCAG 2.2 AA 原則為目標：

- 足夠文字 Contrast
- Keyboard 可操作
- Focus State 清楚
- Form Element 有 Label
- Status 不只靠顏色
- Dialog / Drawer 正確管理焦點

## 拾參、實作規則（Implementation Rules）

- 優先建立共用 Design Token。
- 避免 Page-specific CSS 重複定義相同 Pattern。
- 不任意使用 Inline SVG，優先使用既定 Icon Library。
- 新增 Pattern 前先確認既有元件是否可延伸。

## 已選定的 Prototype 視覺方向｜2026-09-28

產品負責人選擇第二版「深海軍藍」，搭配 C 布局。此方向取代先前的亮藍提案；細部仍可在 Prototype review 調整。

| 用途 | 色號 |
|---|---|
| 側欄 | `#102A43` |
| 主要操作／選取 | `#1849A9` |
| 工作區背景 | `#F1F4F8` |
| 面板 | `#FFFFFF` |
| 主要文字 | `#142B45` |
| 次要文字 | `#5E6E80` |
| 邊線 | `#D6DEE9` |

採小圓角、細邊線、低彩度狀態標籤，不使用漸層或發光裝飾。工作文字以 14px 為主，12px 僅用於輔助資訊。上一筆／下一筆與處理按鈕維持可辨識尺寸。Logo 暫用文字標誌及 Lucide 勾號，正式圖檔待原始素材替換。

首屏只放案件身分、建議、待確認事項與必要金額對照；底部保留操作。完整檢查、規範、憑證與歷史依需要展開，取代上文全量資訊層級同時呈現的方式。導覽、頁首帳號及工作內容各自固定角色，不在每個區塊重複功能名稱或內部開發說明。

表格一列一案件，案件編號、申請人、金額、初審建議、處理狀態獨立欄位；窄版並排時隱藏費用類別，詳情仍可查看。整列可點擊，案件編號按鈕支援鍵盤操作。列表與詳情各自捲動，切換案件保留搜尋及篩選。

有附件的案件均提供展示用模擬憑證預覽及放大檢視，依費用明細切換；這些是人工製作的 Fixture，不是真實文件或 OCR 結果。格式檢查的模擬門檻在規則依據中明確標示，不代表真實法定門檻。未達適用門檻顯示不適用，不使用通過綠勾。
