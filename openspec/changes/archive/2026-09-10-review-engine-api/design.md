## Context

見 `proposal.md` — Why。資料庫、治理約束、shared 領域契約與 seed 已就緒
（來自 `bootstrap-m1-foundation`）；`apps/api/src` 仍是 NestJS 樣板。完整 API 設計見
`docs/API_SPEC.md`——本 design 著重架構決策，不重述每支端點的 payload。來自 `CLAUDE.md`
的約束：run 建立為非同步；Reviewer 動作以 shared 矩陣驗證；每個人工動作於同一 transaction
附帶 hash-chained 稽核事件；DB CHECK/trigger 已強制 evidence-required 與 append-only。

## Goals / Non-Goals

**Goals：**

- 於 `apps/api/src/review/` 建立 NestJS 模組，讓 Reviewer 工作台能為 demo 端到端運作。
- 保持 API 契約穩定（非同步 run），使 Phase-2 OCR 僅需替換 runner。
- 重用 shared disposition 矩陣（API 內不重新實作）。

**Non-Goals：**

- 不做完整規則引擎——DEMO 級判定（讀 seed 已算好的 run，或小型映射）即可，
  完整 R1~R10 handler 屬後續 change。
- 不做 OCR／LLM／Redis／pgvector。
- 不做前端（屬組員 A／B 的 change）。
- 不做認證／登入——demo 的 actor 用固定的 seed 使用者。

## Decisions

- **模組切分於 `apps/api/src/review/`：** `common`（PrismaService、health）、
  `cases`（summary/list/detail/related/audit）、`policies`、`runs`（create/status）。
  理由：對齊 CODEOWNERS 的擁有權、保持 controller 精簡。替代方案（單一大模組）已否決
  ——較難依區域分開審查。
- **DTO／回應型別放 `packages/shared`。** API 與前端都 import 同一份，契約不會漂移。
  替代方案（api 本地 DTO）已否決——會與 web 脫鉤。
- **判定為 DEMO 簡化版。** `POST /runs` 建立 ReviewRun，並由 seed 已算好的 classification
  （或小型確定性映射）解析結果，然後標記 run `SUCCEEDED`。理由：demo 價值在工作台流程，
  不在引擎完整性。無論如何皆保留非同步契約（202 + 輪詢），依 CLAUDE.md。
- **Disposition 驗證用 shared 的 `resolveDisposition()`。** controller 在碰 DB 前就以 400
  拒絕非法動作，使 DB CHECK 約束為後備防線而非主要防線（較佳的錯誤體驗）。
- **人工動作跑在 Prisma `$transaction`**，同時寫入領域列（Disposition／SupervisorReview）
  與 hash-chained AuditEvent，使部分寫入不可能留下「有動作卻無稽核事件」的狀態。

## Risks / Trade-offs

- **DEMO 判定與真實規則引擎分歧** → 把判定隔離在小型 `runner` 介面後，未來真引擎可替換而
  不動 controller／契約。
- **無認證使 actor 為假造** → 用清楚標示的 seed reviewer／supervisor 使用者；註明認證屬
  後續議題（不在 M1 demo 範圍）。
- **API 手寫的稽核 hash 邏輯可能與 seed 分歧** → 重用 seed 所用的 hash helper
  （`prisma/seed/hash-chain.ts` 的邏輯）或抽成共用 util，使 chain 驗證保持一致。
- **`packages/shared` 由三人共同碰觸** → 此處只 ADD 回應型別；不修改 disposition 矩陣
  （屬 schema-owner 範圍）。

## Migration Plan

1. 加入 `PrismaService` + health 端點；驗證 `GET /api/health` 回 ok。
2. 加入讀取端點（summary/list/detail/policies）對 seed 資料。
3. 加入 runs（建立 202 + 狀態輪詢）與 DEMO 判定。
4. 加入 disposition + supervisor-review（交易式、矩陣驗證）。
5. 加入稽核軌跡取得與 chain 驗證。
6. 將模組接進 `app.module.ts`；`pnpm lint && typecheck && test && build`。

- 回滾：於樣板之上為附加式，revert PR 即可。無 DB 變更（schema 已 migrate）。

## Open Questions

- 是否把稽核 hash-chain helper 抽到 `packages/shared`（讓 seed 與 API 共用同一實作）。
  可延後——待兩處呼叫點都存在後再做小型重構即可；不改變 spec 或任務拆解。
