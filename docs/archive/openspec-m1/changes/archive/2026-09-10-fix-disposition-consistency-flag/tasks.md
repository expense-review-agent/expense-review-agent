## 1. 共用領域契約（packages/shared）

> 可獨立審查。這一組做完，`packages/shared` 自身測試即應全綠，不依賴 api 或 DB。

- [x] 1.1 在 `packages/shared/src/enums.ts` 的 `consistencyFlagSchema` 新增 `PENDING_DECISION`，驗證 `pnpm --filter shared typecheck` 通過（enum-parity 測試此時**應該紅**，因為 Prisma enum 尚未同步——這是預期的，由 2.1 修復）
- [x] 1.2 在 `packages/shared/src/domain/disposition.ts` 新增 `deriveConsistencyFlag({ agentActionAtDecision, finalAction })`，回傳 `{ flag, reasonRequired }`，實作 design.md 決策 1 的六列算式，驗證函式為純函式（不讀取矩陣以外的任何狀態）
- [x] 1.3 移除 `DISPOSITION_MATRIX` 中 `MANUAL_REVIEW.MANUAL_JUDGEMENT` 的 `escalates: true`，驗證既有 `disposition.test.ts` 的「accepting MANUAL_REVIEW escalates」仍通過（該測試針對 `ACCEPT`，不應受影響）
- [x] 1.4 在 `packages/shared/src/__tests__/` 新增徽章算式測試：窮舉 3 種 `agentActionAtDecision` × 4 種 `finalAction`（`APPROVE`/`REQUEST_INFO`/`MANUAL_REVIEW`/`null`）共 12 組，外加 `agentActionAtDecision = null` 邊界，驗證每組的 `flag` 與 `reasonRequired` 皆符合 design.md 表格
- [x] 1.5 新增測試斷言「相同 (agentActionAtDecision, finalAction) 必得相同 flag，與 reviewerAction 無關」，驗證 spec 的 `Flag derivation ignores the reviewer action label` scenario
- [x] 1.6 在 `packages/shared/src/api.ts` 的 `dispositionRequestSchema` 新增 `finalAction: recommendedActionSchema.optional()`，驗證 `pnpm --filter shared typecheck` 通過

## 2. 資料模型與 migration（apps/api/prisma）

> 受管路徑（CODEOWNERS: @ChichiTung）。已於提案階段取得 schema owner 授權。

- [x] 2.1 在 `schema.prisma` 的 `ConsistencyFlag` enum 新增 `PENDING_DECISION`（含註解說明「雙方皆未下結論且案件留在待審」），並更新該 enum 上方的算式註解涵蓋此值
- [x] 2.2 執行 `pnpm --filter api prisma:migrate` 產生新 migration，驗證產出的 `migration.sql` **只含一行** `ALTER TYPE "ConsistencyFlag" ADD VALUE 'PENDING_DECISION';`，且**未修改任何已 commit 的 migration 檔**
- [x] 2.3 驗證不需修改 `disposition_reason_required` CHECK：對已 migrate 的 DB 手動 INSERT 一筆 `consistencyFlag = 'PENDING_DECISION'` 且 `reason` 為 NULL 的 Disposition，確認被接受；再 INSERT 一筆 `OVERRIDDEN` 且 `reason` 留白，確認被 DB 拒絕
- [x] 2.4 執行 `pnpm --filter shared test`，驗證 enum-parity 測試由 1.1 的紅轉綠（Prisma enum 與 shared enum 恢復一對一）

## 3. 後端處置寫入（apps/api/src/review）

> 依賴 1 與 2。開工前先跑 `pnpm --filter shared build`（api 吃 dist）。

- [x] 3.1 在 `review.service.ts` 的 `disposition()` 加入 `finalAction` 請求驗證：`MANUAL_JUDGEMENT` 缺 `finalAction` 回 400、非 `MANUAL_JUDGEMENT` 卻帶 `finalAction` 回 400，驗證兩種情況皆在任何 DB 寫入前被擋下
- [x] 3.2 依 design.md 決策 3/6 計算 `finalAction`（`ACCEPT` → `agentActionAtDecision`；`REQUEST_INFO` → `REQUEST_INFO`；`MANUAL_JUDGEMENT` → 請求值；`HOLD` → `null`）與 `finalClassification`（僅在 `finalAction === agentActionAtDecision` 時等同 `agentClassificationAtDecision`，否則 `null`），驗證寫入的 Disposition 兩欄不再是 Agent 建議的複本
- [x] 3.3 移除 `computeConsistencyFlag()`，改呼叫 shared 的 `deriveConsistencyFlag()`，驗證 `apps/api` 內不再有任何本地徽章計算邏輯（grep `ConsistencyFlag` 應只剩型別引用）
- [x] 3.4 理由必填判斷改為 `resolveDisposition().reasonRequired` 與 `deriveConsistencyFlag().reasonRequired` 的聯集，缺理由回 400 且不進 DB，驗證 `OVERRIDDEN` 與 `HUMAN_ASSUMED` 兩種情境都被擋
- [x] 3.5 `REVIEWER_DISPOSITION` 的 `AuditEvent` payload 增列 `finalAction` 與 `consistencyFlag`，驗證 `GET /api/cases/:id/audit` 不需查 Disposition 表即可讀出人工結論，且 `chainValid` 仍為 `true`

## 4. 後端測試（apps/api）

> `apps/api` 目前零測試檔；本組建立第一個。**不新增任何 npm 套件**（jest 與 `@nestjs/testing` 已在相依內）。

- [x] 4.1 新增 `apps/api/src/review/review.service.spec.ts`，以手寫 fake Prisma 注入，驗證 `pnpm --filter api test` 從「0 tests」變成實際執行
- [x] 4.2 補測試覆蓋 spec 的四個 400 scenario：非法動作、缺必填理由、`MANUAL_JUDGEMENT` 缺 `finalAction`、非 `MANUAL_JUDGEMENT` 卻帶 `finalAction`，各自驗證 fake Prisma 的 `$transaction` **未被呼叫**（證明無狀態變更）
- [x] 4.3 補測試覆蓋四種徽章的寫入路徑（`CONSISTENT` / `OVERRIDDEN` / `HUMAN_ASSUMED` / `ESCALATED` / `PENDING_DECISION`），驗證傳給 `disposition.create` 的 `finalAction`、`finalClassification`、`consistencyFlag` 三欄皆符合預期

## 5. 整合驗證

- [x] 5.1 `pnpm --filter shared build && pnpm lint && pnpm typecheck && pnpm test && pnpm build` 四關全綠
- [x] 5.2 `pnpm --filter api db:reset` 後實跑一條龍：對 `EXP-2026-2001`（建議 APPROVE）送 `MANUAL_JUDGEMENT + finalAction=REQUEST_INFO + reason`，驗證 DB 寫出 `consistencyFlag = OVERRIDDEN`（修正前會錯寫成 `HUMAN_ASSUMED`）
- [x] 5.3 對 `EXP-2026-2004`（建議 MANUAL_REVIEW）分別送 `ACCEPT` 與 `MANUAL_JUDGEMENT + finalAction=APPROVE`，驗證前者得 `ESCALATED`、後者得 `HUMAN_ASSUMED` 且**不觸發轉呈**
- [x] 5.4 送一筆 `HOLD`，驗證寫出 `consistencyFlag = PENDING_DECISION`、`finalAction` 為 `null`、案件狀態留在 `QUEUED`、且未因缺理由被拒
- [x] 5.5 `GET /api/cases/:id/audit` 驗證上述每筆處置都有對應稽核事件、payload 含 `finalAction` 與 `consistencyFlag`、`chainValid` 為 `true`

## 6. 文件同步

- [x] 6.1 更新 `docs/API_SPEC.md` 的 #10 請求範例加入 `finalAction`，並註明各動作的必填／禁帶規則，驗證文件與 `dispositionRequestSchema` 一致
- [x] 6.2 在 `docs/PROJECT_STATUS.md` 的 `review-engine-api` 段落註記本次修正（該 change 原標 20/20 結案，實際留有此缺陷），驗證交接文件不再與程式現況矛盾

> **前端**：本 change 無 `apps/web` 工作項。`apps/web` 尚未開始實作，`MANUAL_JUDGEMENT`
> modal 需送出 `finalAction` 的契約由 1.6 定案，前端開工時直接依 `packages/shared` 型別實作。
