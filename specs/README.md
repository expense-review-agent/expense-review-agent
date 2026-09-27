# Specs

此目錄保存 **已經收斂、需要穩定實作的 User Story / Feature 行為規格**。

目前不使用 OpenSpec。產品流程尚在探索時，先透過 Product Docs、Design Docs、Mock Data 與實際介面驗證；行為確認後，再補成 Spec。

## 什麼時候需要新增 Spec

符合以下情況時再建立：

- 功能已確定要做
- User Flow 已大致收斂
- 需要多人或 AI 依一致規則實作
- 有明確可驗收行為
- 後續修改需要知道「原本應該怎麼運作」

探索中的想法不要先寫成正式 Spec。

## 建議命名

例如：

- specs/review-case.md
- specs/request-missing-information.md
- specs/escalate-case.md
- specs/override-recommendation.md

避免用 frontend-v2.md、backend-api.md、database-change.md 等技術 Layer 作為 Product Spec。

## Spec 最小結構

每份 Spec 至少包含：

### User Story
As a ...
I want ...
So that ...

### Context
為什麼需要這個功能，以及它解決什麼問題。

### Behavior
系統應如何運作。

### Acceptance Criteria
- Given ...
- When ...
- Then ...

### Edge Cases
- ...

## 原則

- 一份 Spec 對應一個可獨立驗證的 Product Slice。
- Acceptance Criteria 描述可觀察行為。
- 不把 Product Brief 或 Product Scope 大段複製進來。
- 若 Spec 與 Product Scope 衝突，先釐清產品決策再實作。
- Bug Fix、Refactor、Chore、Spike 不一定需要建立 User Story Spec。
