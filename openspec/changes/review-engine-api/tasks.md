## 1. 共用型別（packages/shared）

- [x] 1.1 在 `packages/shared` 新增 API 回應/請求型別（case list/summary/detail、policy、run、disposition、supervisor-review、audit），並驗證 `pnpm --filter shared typecheck` 通過
- [x] 1.2 驗證新型別引用既有 enum 與 disposition 矩陣（不重複定義），`pnpm --filter shared test` 通過

## 2. 後端基礎（apps/api/src/review/common）

- [x] 2.1 建立 `PrismaService`（onModuleInit 連線、onModuleDestroy 斷線），並在 `app.module.ts` 注入，驗證 `pnpm dev:api` 啟動無錯
- [x] 2.2 實作 `GET /api/health` 回 `{ status: "ok" }`，驗證 `curl localhost:3000/api/health` 得到 ok

## 3. 讀取 API（cases + policies）

- [x] 3.1 `GET /api/cases/summary` 回四狀態計數，驗證計數與列表一致（對 seed 資料）
- [x] 3.2 `GET /api/cases?status=` 回案件列表（可選 status 篩選），驗證 `?status=NORMAL` 只回 NORMAL 案件
- [x] 3.3 `GET /api/cases/:id` 回單案完整詳情（申請資訊 + checks + suggestion + 規範引用 + evidence），驗證非通過 check 都帶 evidence；不存在的 id 回 404
- [x] 3.4 `GET /api/cases/:id/related` 回關聯案件（R7/拆單），驗證重複案件能取到參照案件
- [x] 3.5 `GET /api/policies?category=` 回啟用中的規範，驗證 ruleCode 與 case detail 的 checks ruleCode 一致

## 4. 非同步 Run（runs）

- [x] 4.1 `POST /api/cases/:id/runs` 建立 ReviewRun 並回 `202 + runId`（不阻塞判定），DEMO 判定用 seed 已算好的結果或簡單映射，驗證回應為 202 且含 runId
- [x] 4.2 `GET /api/runs/:runId` 回 run 狀態（PENDING/RUNNING/SUCCEEDED/FAILED），驗證輪詢可取到 SUCCEEDED
- [x] 4.3 將判定邏輯隔離在 `runner` 介面後（DEMO 實作），驗證未來可替換不動 controller/契約

## 5. 人工處置與稽核（disposition + supervisor + audit）

- [ ] 5.1 `POST /api/cases/:id/disposition`：用 shared `resolveDisposition()` 驗證動作合法性，非法動作回 400（不進 DB），驗證非法動作測試通過
- [ ] 5.2 disposition 需理由卻留白時回 400；`MANUAL_REVIEW + ACCEPT` 走 escalate，驗證兩種行為的測試通過
- [ ] 5.3 disposition 成功時於同一 `$transaction` 寫入 Disposition（append-only）+ 一筆 hash-chained AuditEvent，驗證 DB 出現對應兩列
- [ ] 5.4 `POST /api/cases/:id/supervisor-review`：寫入 SupervisorReview + AuditEvent；FLAG_CONCERN 無 comment 回 400，驗證測試通過
- [ ] 5.5 `GET /api/cases/:id/audit` 依 seq 回稽核軌跡並回報 `chainValid`，驗證竄改一筆後 chainValid=false

## 6. 整合驗證

- [x] 6.1 將所有模組接進 `app.module.ts`，`pnpm lint && pnpm typecheck && pnpm test && pnpm build` 四關全綠
- [ ] 6.2 `db:reset` 後端到端跑通：summary → list → detail → run → disposition → audit 一條龍，驗證前端可據此演出 demo 流程

## 7. 選用（可延後，不影響 demo）

- [ ] 7.1（Open Question）將稽核 hash-chain helper 抽到 `packages/shared` 供 seed 與 API 共用，驗證兩處 chain 計算一致
