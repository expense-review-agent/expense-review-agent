## Why

`review-engine-api` 交付的 `POST /api/cases/:id/disposition` 有兩個相互關聯的缺陷，
使 **M1-U2「財務主管可追溯 Agent 與人工判斷」的稽核資料失真**：

1. **人工最終結論從未被記錄。** `apps/api/src/review/review.service.ts` 把
   `finalClassification` / `finalAction` 直接寫成 `run.classification` /
   `run.recommendedAction`——不論 reviewer 選了什麼動作，DB 記下的「人工最終結論」
   永遠等於 Agent 建議。reviewer 用 `MANUAL_JUDGEMENT` 推翻 Agent 的判斷，稽核軌跡上
   看不出來他改成了什麼。
2. **一致性徽章沒有依定案算式計算。** `computeConsistencyFlag()` 只看 `action` 與
   `escalates`，完全沒用到 `finalAction` 與 `agentActionAtDecision`。`CLAUDE.md`
   明訂「徽章由 `finalAction` 與 `agentActionAtDecision` 計算後**固化寫入**」，
   `schema.prisma` 的 `ConsistencyFlag` 註解也寫死了算式。實作與兩者都不符，例如：

   | agentAction     | reviewerAction     | 定案算式        | 目前實作           |
   | --------------- | ------------------ | --------------- | ------------------ |
   | `APPROVE`       | `MANUAL_JUDGEMENT` | `OVERRIDDEN`    | `HUMAN_ASSUMED` ❌ |
   | `MANUAL_REVIEW` | `REQUEST_INFO`     | `HUMAN_ASSUMED` | `OVERRIDDEN` ❌    |

徽章是 M1-U2 AC10「篩選需複核案件」的依據。算錯的徽章會讓主管漏看被推翻的案件，
也讓 `Disposition` 的 DB CHECK（`OVERRIDDEN` / `HUMAN_ASSUMED` 必附理由）擋在錯誤的
情境上。因為 `Disposition` 是 append-only，**寫錯的資料無法修正，只能靠新事件疊加**
——越晚修，錯誤資料越多。

服務 **M1 Review Copilot**，主要對應 **M1-U2**（主管追溯），並影響 **M1-U1**
（reviewer 的 `MANUAL_JUDGEMENT` 才真正生效）。

## What Changes

- **`finalAction` / `finalClassification` 依實際人工動作寫入**，各動作來源明確定義：
  - `ACCEPT` → 沿用 `agentActionAtDecision`（採用 Agent 建議）
  - `REQUEST_INFO` → `REQUEST_INFO`
  - `MANUAL_JUDGEMENT` → 取自請求體的 `finalAction`（必填）
  - `HOLD` → `null`（尚未下結論）
- **BREAKING**：`DispositionRequest` 新增 `finalAction?: RecommendedAction` 欄位。
  `MANUAL_JUDGEMENT` 時**必填**（缺漏回 400）；其餘動作**不得帶**（帶了回 400）。
  對應 `schema.prisma` 既有註解「`MANUAL_JUDGEMENT` 由 UI modal 指定 `finalAction`
  （通過／補件／人工審核）並必填理由」。
- **一致性徽章改依定案算式計算**，輸入為 `finalAction` 與 `agentActionAtDecision`，
  不再依賴 `reviewerAction` 與 `escalates`。算式抽到 `packages/shared` 成為單一實作，
  前後端共用（與 disposition 矩陣同一個地盤）。
- **BREAKING**：`ConsistencyFlag` enum 新增 `PENDING_DECISION`，用於 `HOLD`
  ——雙方皆未下結論且案件留在待審。既有五個值語意都不涵蓋此情境，而
  `Disposition.consistencyFlag` 是 NOT NULL，不能留白。需新增 migration。
- **修正 `DISPOSITION_MATRIX`**：移除 `MANUAL_REVIEW + MANUAL_JUDGEMENT` 的
  `escalates: true`。人工既然指定了 `finalAction`，依算式即為 `HUMAN_ASSUMED`
  （人承擔判斷），與「雙方皆未下結論才轉呈」的 `ESCALATED` 語意衝突。
- **補上徽章計算的測試**。`CLAUDE.md` 要求「矩陣、徽章計算、雙假設評估這三處必須有
  測試」，徽章計算目前零測試——正是本次缺陷未被攔截的原因。

本 change **不引入任何新的執行期相依**，不涉及 OCR／LLM／Redis／pgvector。

## Capabilities

> 註：`openspec/specs/` 目前是空的（`bootstrap-m1-foundation` 與 `review-engine-api`
> 皆尚未 `sync-specs`）。下列路徑取自那兩個 change 的 delta spec，是這些 capability
> 既定的路徑，sync 時會落到同一位置。

### New Capabilities

<!-- 無。本 change 修正既有 capability 的行為，不引入新能力。 -->

### Modified Capabilities

- `review-api`: 「以 shared 矩陣驗證的 Reviewer 處置」requirement 擴充——處置除了
  驗證動作合法性，還 MUST 記錄人工最終結論，並依 `finalAction` 與
  `agentActionAtDecision` 計算固化的一致性標記。新增 `MANUAL_JUDGEMENT` 必附
  `finalAction` 的驗證要求。
- `shared-domain`: 一致性標記的計算成為 shared 契約的一部分（與合法動作矩陣同源，
  前後端不得各自實作）；矩陣中 `MANUAL_REVIEW + MANUAL_JUDGEMENT` 的轉呈語意修正。
- `data-model`: `ConsistencyFlag` 值域擴充 `PENDING_DECISION`；`Disposition` 的
  「需要理由不得留白」CHECK 之適用值域需與新算式一致。

## Impact

**受管路徑（依 `.github/CODEOWNERS`，全部指向 @ChichiTung）**

- `apps/api/prisma/schema.prisma` — `ConsistencyFlag` enum 新增值。
  **本次改動已由 schema owner 在提案階段明示授權**（`CLAUDE.md`「想改 schema.prisma
  或 migration → 先問，不要自己動」的前置條件已滿足）。
- `apps/api/prisma/migrations/` — **新增**一個 migration（`ALTER TYPE ... ADD VALUE`）。
  既有已 commit 的 migration 不修改。
- `packages/shared/src/domain/` — 新增徽章計算函式；修改 `DISPOSITION_MATRIX` 一格。
- `apps/api/src/review/` — `review.service.ts` 的 disposition 寫入與徽章計算。

**其他影響**

- `packages/shared/src/api.ts` — `dispositionRequestSchema` 新增 `finalAction`。
- `packages/shared/src/enums.ts` — `consistencyFlagSchema` 新增值；
  `enum-parity` 測試會同步驗證與 Prisma enum 一致。
- `apps/web` — 尚未開始實作，**無既有前端需要遷移**。但 `MANUAL_JUDGEMENT` 的 modal
  必須送出 `finalAction`，此契約需在前端開工前定案（本 change 即為定案動作）。

**可追溯性影響（本 change 的核心）**

- 不新增稽核欄位——是讓 `Disposition` 既有的 `finalAction` /
  `finalClassification` / `consistencyFlag` **真正承載它們被設計來承載的資訊**。
- `AuditEvent` 的 `REVIEWER_DISPOSITION` payload 增列 `finalAction` 與
  `consistencyFlag`，使稽核軌跡本身即可讀出人工結論，不必回查 `Disposition` 表。
- **既有資料**：seed 重建即可（`db:reset`）。正式環境無資料，不需回填腳本；
  且 `Disposition` append-only，本來就不允許回填修改。
