## Context

現況見 `proposal.md` 的 Why。設計上需要納入的既有約束：

- **前端沒有測試框架**（刻意）。判定與呈現邏輯一律放 `packages/shared`，以 `node --test` 測；
  React 元件只渲染。篩選與計數規則因此屬 shared，不是 `apps/web` 的 local state 邏輯。
- **計數的單一資料來源**。`reviewer-workbench-queue-detail` 的 tasks 9.2 已定案：卡片與 chip 的計數
  由過濾後的列表計算，前端**不用** `/cases/summary`（那支會把帶 run 的已結案案件算進分類）。
  本 change 的計數必須沿用這個來源，否則已結案案件會又被算進分類。
- **API 契約只加不改**。`caseListItemSchema` / `caseDetailSchema` 前端已依賴，只能加欄位。
- **`Disposition` 是 append-only**，DB trigger 擋 UPDATE/DELETE。徽章是寫入時固化的值。
- **`packages/shared/src/domain/` 與 `schema.prisma` 有 owner**（CODEOWNERS → @ChichiTung）。
  本 change 要改 schema，已取得同意；`domain/disposition.ts` 的矩陣與徽章算式**不動**。
- M1 案件量是 demo 規模（5～10 筆），列表一次撈回沒有分頁。

需求細節見 `specs/`。

## Goals / Non-Goals

**Goals:**

- 篩選、搜尋、排序與計數規則是 shared 裡可被 `node --test` 窮舉的純函式，
  不是散在元件裡的 `useMemo`。
- 畫面上只有一個會隨操作變動的數字（結果筆數），且它永遠等於列表筆數。
- 處置人是「顯示既有 append-only 資料」，不新增任何稽核欄位、不改寫任何既有紀錄。
- 已結案案件由後端依流程狀態取回，與案件總覽的預設列表是兩個獨立查詢，互不污染統計。
- 部門是案件層的時點快照，不引入員工／組織主檔。

**Non-Goals:**

- **分頁與伺服器端的搜尋／排序**。搜尋與排序本輪要做，但都在前端那份已撈回的列表上進行
  （見 Decision 9）；案件量長大到需要分頁時，搜尋與排序得一起搬到後端，那時另開 change。
- 跨案件風險計算、頻率統計、申請人畫像——M2 範圍，`specs/` 已明文禁止出現在申請紀錄彈窗。
- 後端狀態機防護（非 `QUEUED` 不可處置、主管核可推進 `REVIEW_CLOSED`）。本 change 只顯示處置人，
  不改處置的前置條件；那是另一個 change。
- 主管稽核 UI、稽核軌跡頁、費用規範頁、重跑 run。
- 暗色主題、行動版版面、登入與角色切換。

## Decisions

**1. 篩選、搜尋、排序與計數邏輯放 `packages/shared/src/presentation/queue-view.ts`**

匯出：`queueItems()`（沿用既有的排除 `REVIEW_CLOSED`）、`matchesSearch(item, term)`、
`filterQueue(items, { search, classification, caseStatus })`、`sortQueue(items, { key, direction })`、
`classificationCounts(items)`、`buildQueueView(items, query, sort)`。

**管線順序是這個設計的核心**，各階段不可互換：

```
基底（排除 REVIEW_CLOSED）→ 搜尋 → 兩個維度（AND）→ 排序 → 結果筆數
     ↘ 統計卡片的計數只看這一層，不受後面任何階段影響（固定總覽）
```

- **統計卡片計數在基底層算完**，之後的搜尋與篩選都不再碰它。`classificationCounts` 因此不收
  `query` 參數——不給它機會依賴當前條件，就不可能寫成會跳動的版本。
- 列表 = 搜尋 + 兩個維度都套用，最後排序。
- **結果筆數 = 列表長度**，由 `buildQueueView` 一起回傳，不是呼叫端自己數。
- 處理狀態控制項不顯示計數，所以沒有第二組計數要維護。

**為什麼改成這樣**（原本是「兩組計數交叉反映」）：那個版本讓畫面上有 9 個會跳動的數字
（5 張卡 + 4 個 chip），每次點任何東西全部重算。目標是「卡片數字 = 點下去的筆數」，
但代價是認知負荷與「數字一直變所以不敢信」。

改成固定卡片 + 單一結果筆數後，三者各自只做一件事：卡片是情勢總覽（穩定、不跳動）、
chip 是純控制項、「共 N 筆」是唯一反映當前結果的數字。**會動的那個數字永遠是對的**，
而這是唯一需要保證的不變量。

代價是誠實的：套用處理狀態或搜尋時，卡片數字可能大於點下去的筆數。這在「卡片 = 總覽」的
框架下不算騙人，且結果筆數就在表格旁邊隨時校正。ERP 清單的實務也是這樣分工——
儀表板 KPI 會跳動就不叫 KPI。

測試的不變量隨之簡化為兩條，而且更好測：
`classificationCounts` 對任何 query 都回傳相同結果；`resultCount === items.length`。

檔名用 `queue-view.ts` 而不是 `queue-filter.ts`：它同時負責篩選、搜尋、排序與計數。

替代方案：在 `apps/web/src/features/queue/model.ts` 擴充。否決——web 沒有測試框架，而計數與篩選
是最容易寫錯且最不容易用眼睛看出來的部分（錯了只是數字小一點）。現有 `model.ts` 的
`queueItems` / `classificationCounts` 移進 shared 後，`model.ts` 只留 re-export 或直接刪除。

**2. 分類與處理狀態篩選在前端做；已結案頁面走後端參數**

案件總覽已經一次撈回全部案件，兩個維度都在前端那份資料上篩選——這也讓結果筆數必然等於列表筆數（Decision 1）。
已結案頁面則呼叫 `GET /api/cases?caseStatus=REVIEW_CLOSED`，因為預設列表刻意排除這些案件，
若改成前端從同一份資料過濾，就得讓總覽把已結案案件也撈回來，再小心地在每個計數處排除它們——
那正是目前 `/cases/summary` 算錯分類的原因。兩個查詢分開，TanStack Query 的 cache key 也分開。

替代方案：全部走後端參數。否決——每切一次 chip 或每打一個字就發一次請求，以 demo 規模的資料量
沒有意義；固定的卡片計數也只需要一份完整列表即可算出，不必為此新增統計端點。

**3. 後端新增獨立的 `caseStatus` query 參數，不修 `status`**

`status` 目前比對的是 `run?.classification ?? c.status` 這個合併值（`cases.service.ts`），
前端與既有 spec scenario 都依賴它。修它的語意會破壞契約，所以新增 `caseStatus` 參數，
在 Prisma `where` 上直接對 `ExpenseCase.status` 篩選（DB 層篩，不是撈回後過濾），
兩個參數同時給定時為 AND。

替代方案：讓 `status` 智慧判斷傳入值是分類還是流程狀態。否決——`REVIEW_CLOSED` 這種值兩邊都合法，
語意會變得不可預測，且無法表達「分類 MISSING 且流程狀態 AWAITING_INFO」。

**4. 詳情回傳最新一筆處置，欄位為可為 null 的物件**

`caseDetailSchema` 新增 `disposition: { actorName, decidedAt, action, consistencyFlag } | null`。
後端以 `dispositions: { orderBy: { createdAt: "desc" }, take: 1, include: { actor: true } }` 取得，
徽章直接讀 `disposition.consistencyFlag`（固化值），**不呼叫 `deriveConsistencyFlag`**——
CLAUDE.md 規定不得在讀取時重算，Policy 改版會讓歷史徽章翻臉。

只回傳最新一筆而非全部：詳情抽屜只需要「誰讓這個案件變成現在這個狀態」。完整歷程屬稽核軌跡頁
（另一個 change，那裡要回傳全部）。

替代方案：前端另呼叫 `GET /cases/:id/audit` 自己撈。否決——稽核事件的 payload 是稽核格式，
前端得反解析事件內容才能取得處置人，等於在 UI 端重建領域語意。

**5. 部門存 `ExpenseCase.applicantDepartment String?`**

與 `applicantName` 同層的去正規化時點快照。理由：案件層本來就存申請人姓名而非 FK 到 `User`
（既有系統的資料是複製進來的快照）；部門跟著同一個模式，讓「案件顯示的是當時的部門」自然成立。

替代方案一：建 `Department` 表 + FK。否決——M1 沒有組織主檔同步來源，會多一張永遠只有 seed 資料的表，
且組織調整會讓歷史案件的部門跟著變（違反時點快照）。
替代方案二：掛在 `User` 上。否決——申請人不是系統使用者（`User` 只有 reviewer／supervisor），
案件的申請人只是字串。

Migration 新增一個 nullable 欄位，無 backfill 需求（既有案件就是「未記錄」）。
**不修改任何已 commit 的 migration。**

**6. 申請紀錄以「案件為起點」查詢：`GET /api/cases/:id/history?scope=applicant|department`**

而不是 `/applicants/:name/cases` 或 `/cases?applicant=...`。理由：申請人沒有穩定識別——
`applicantCode` 是 optional 且 seed 未填，只剩姓名字串，把姓名放進 URL 會遇到編碼、同名歧義，
也把「用什麼欄位比對」這個領域決定推給前端。以案件為起點，後端用該案的 `applicantName`
（有 `applicantCode` 時優先用它）或 `applicantDepartment` 在同一 `organizationId` 內查詢，
並天然滿足 spec 的「結果必須包含查詢起點案件」。

`scope` 為 `department` 但該案沒有部門時回 400（前端本來就不該讓該欄可點選）。

**7. seed 用真正的 Disposition 取代寫死的狀態**

- `EXP-2026-2001`（NORMAL／APPROVE）：`ACCEPT` → `finalAction = APPROVE`、
  `resultingStatus = DISPOSED`、徽章 `CONSISTENT`。
- `EXP-2026-2002`（EXCEPTION／MANUAL_REVIEW）：`ACCEPT` → escalate。`ACCEPT` 的 `finalAction`
  由動作本身決定（= 當時的建議），與 API 的 `resolveFinalAction` 一致 → `finalAction = MANUAL_REVIEW`
  → 徽章 `ESCALATED`、`finalClassification = EXCEPTION`、`resultingStatus = DISPOSED`。
  這筆讓 demo 出現一個「已轉呈主管」的真實狀態。

  ⚠️ 初版設計誤寫為 `finalAction = null` → `PENDING_DECISION`。那是錯的：`PENDING_DECISION` 只在
  `finalAction` 為 null 時產生，而那只發生在 `HOLD`，`HOLD` 的 `resultingStatus` 是 `QUEUED`——
  「`PENDING_DECISION` + `DISPOSED`」是真實流程產不出來的組合。實作時由端到端驗證抓到
  （前端顯示的徽章與 API 實際寫入的不一致），已修正。這也正是 `specs/demo-seed`
  「每個非 QUEUED 狀態都必須有真實流程能產生的處置紀錄」那條需求要防的錯。

兩筆都以 `resolveDisposition()` 決定 `resultingStatus`、以 `deriveConsistencyFlag()` 決定徽章
（seed 寫入時算一次並固化，與 API 同一份算式），並補 `REVIEWER_DISPOSITION` 稽核事件接上 hash chain。
`makeCase()` 的 `status` 參數保留，但 `DISPOSED` / `AWAITING_INFO` 的案件必須接著建 Disposition——
`specs/demo-seed` 的 scenario 就是在測這件事。

部門：至少兩筆同部門（讓部門查詢有多筆結果）、至少一筆未記錄（走無值路徑）。

**8. 已結案頁面用 hash 路由 `#/closed`，抽屜沿用同一個元件**

`router.ts` 的 `Route` 從 `{ name: "queue" }` 擴為 `{ name: "queue" | "closed"; caseId: string | null }`，
`#/closed/:id` 同樣能直接開抽屜。抽屜元件不變：它已經依 `caseStatus !== "QUEUED"` 隱藏處置按鈕，
已結案案件自然不顯示。

替代方案：引入 router 套件。否決——CLAUDE.md 規定新增套件先問，且兩個頁面不值得。

**9. 搜尋與排序在前端做，不引入套件**

- **比對方式**：單一輸入框、跨欄位子字串比對（案件編號、申請人、部門、說明），
  兩邊都 `toLocaleLowerCase()` 後比對。不做權重排名、不做拼字容錯——ERP 清單的搜尋是「找到我記得的
  那張單」，不是搜尋引擎；模糊排名反而讓使用者不確定有沒有漏。
- **不用 regex**：使用者輸入的 `(`、`*` 之類在 regex 下會拋錯或意外匹配。子字串 `includes` 沒有這個問題。
- **debounce 250ms**：輸入即生效但不每個字元都重算。M1 資料量其實不需要，
  但輸入框的 controlled state 與計數重算綁在一起，加上 debounce 之後日後換成後端搜尋不必改介面。
- **排序鍵與方向放在頁面 state**，一次只有一個鍵。排序是穩定排序（`Array.prototype.sort` 在
  現代引擎已保證），所以同日期的案件維持既有次序，不會在切換方向時亂跳。
- **案件編號自然排序**：把編號切成「非數字段 / 數字段」，數字段以數值比較。純字典序在
  `EXP-2026-9` 與 `EXP-2026-10` 會排反；現在的編號寬度一致所以看不出來，但編號格式是客戶端決定的，
  不值得賭。
- **缺值排末尾**：`applicationDate` 在 schema 是 nullable。缺值排末尾（不論升降冪）是 ERP 清單的慣例，
  也避免「排序之後那筆單不見了」這種最糟的體驗——spec 明文要求它仍在列表中。
- **搜尋與排序不進網址**。抽屜的開啟狀態進網址是因為要能分享「這張單」；搜尋字串與排序是個人的暫時
  檢視狀態，進網址會讓分享出去的連結帶著別人的篩選。日後若要「分享這份檢視」再另議。

替代方案：用後端 query 參數做搜尋與排序。否決——理由同 Decision 2（每次輸入都打 API，
demo 規模沒有意義）。案件量長大到需要分頁時再一起搬。

## Risks / Trade-offs

- **[改變已驗證的總覽互動]** `reviewer-workbench-queue-detail` 的 39 項 scenario 有數項是針對分類 chip。
  → 那些 scenario 由本 change 的 MODIFIED 需求取代；重跑 E2E 時以新 spec 為對照，並確認 chip 列真的
  不存在（不是只隱藏）。
- **[固定卡片與結果筆數的落差被誤讀]** 套用處理狀態或搜尋後，卡片顯示 2、列表只有 1 筆。
  → 「共 N 筆」緊貼列表上方，是唯一反映當前結果的數字；空狀態也會說明是篩選或搜尋造成的並提供
  清除入口。卡片的語意由文案定調為總覽（待審總數／分類分佈），不是點擊預覽。
- **[結果筆數與列表脫鉤]** 若呼叫端自己數或自己再篩一次，就可能與列表不一致。
  → `buildQueueView` 同時回傳 `items` 與 `resultCount`（後者就是前者的長度），呼叫端拿不到
  自己算的機會；測試直接斷言兩者相等。
- **[卡片計數日後被「順手」改成跟著篩選]** → `classificationCounts` 不收 query 參數，
  要讓它跟著篩選必須先改簽名；測試也釘住「對任何 query 都回傳相同結果」。
- **[前置依賴未 archive]** 本 change 的 `reviewer-workbench` delta 以 MODIFIED 表述，但該 capability
  還在前一個 change 的 delta 裡，尚未 sync 進 `openspec/specs/`。→ 先由 schema owner 對
  `reviewer-workbench-queue-detail` 執行 `openspec-sync-specs` 與 archive，再開始實作本 change；
  否則 archive 本 change 時 MODIFIED 找不到基準。
- **[schema 變更]** 動到有 owner 的檔案。→ 只加一個 nullable 欄位、只新增 migration、不改既有 migration；
  PR 走 CODEOWNERS review。
- **[seed 破壞性]** 改 seed 會讓現有本機資料與新 seed 不一致。→ `db:reset` 是既有標準流程
  （drop schema → migrate → seed），文件已載明；不做任何 `TRUNCATE`／`DELETE`。
- **[申請紀錄以姓名比對]** 同名申請人會被歸為同一人。→ demo 資料無同名；`applicantCode` 存在時優先使用。
  真實資料的身分解析屬既有系統職責，寫進 backlog。
- **[彈窗越界成風險畫面]** 「同一人多筆申請」很容易被加上頻率警示，那就踩進 M2。
  → spec 明文 MUST NOT，並在 review 時當作紅線檢查。

## Migration Plan

1. schema owner review 並套用部門欄位的 migration（`prisma migrate dev`，**不得 `db push`**）。
2. `pnpm --filter shared build` 後再跑 api（api 吃 `dist`，這是既有踩過的雷）。
3. `pnpm --filter api db:reset` 重建 demo 資料（含新的 Disposition 與部門）。
4. 回滾：部門欄位是 nullable 且只被新程式讀取，前端與 API 的新欄位都是「只加不改」，
   回滾程式碼即可恢復舊行為，不需要 down migration。seed 的處置紀錄是 append-only 資料，
   回滾以 `db:reset` 重建。
