# GitHub 治理設定清單（權限生效步驟）

> 目的：讓 repo 的權限控制**真正生效**。`CODEOWNERS`、`CLAUDE.md`、CI 只是
> 「寫在檔案裡的規則」，沒有下列 GitHub 設定就沒有強制力。
> 這些設定**只有 repo owner / admin 能做**，AI agent 無法代為操作。
>
> 對應 OpenSpec change：`bootstrap-m1-foundation`（tasks §5.2）。

## 為什麼需要這份清單

`CODEOWNERS` 目前把最致命的檔案（`schema.prisma`、`migrations/`、
`packages/shared/src/domain/`、`CLAUDE.md`、`.claude/`）指派給 `@schema-owner`
等佔位帳號。但：

- 佔位帳號**不是真實 GitHub ID** → 指派無效。
- 沒開 branch protection → CODEOWNERS 只會「自動標註審查者」，**擋不住 merge**。
- CI 沒設成 required checks → lint/typecheck/test/build 失敗也能合併。

把下面每一項打勾，權限才算「鎖在人手上」。

## 步驟一：把 CODEOWNERS 佔位帳號換成真人 — 🟡 待補組員 ID

[`CODEOWNERS`](../CODEOWNERS) 已依三人分工指派：

- [x] schema / migration / 領域契約 → `@ChichiTung`（schema owner）
- [x] 後端 review 模組 → `@ChichiTung`（後端引擎）
- [ ] 前端待審佇列頁 → `@memberA`（主前端邏輯）
- [ ] 前端案件詳情頁 + 共用元件 → `@memberA`（主前端邏輯）
- [ ] 前端稽核頁 → `@memberB`（較單純前端）

> ⚠️ **`@memberA` / `@memberB` 仍是佔位**，請把它們換成兩位組員的實際 GitHub ID
> （`CODEOWNERS` 檔內同樣有兩處 TODO 待替換）。換完才算真正生效。
>
> 分工對應：@ChichiTung 後端引擎；@memberA 主前端（queue + detail + 共用元件，較複雜）；
> @memberB 較單純前端（audit 稽核頁，唯讀）。

## 步驟二：開啟 Branch protection（讓 CODEOWNERS 有強制力）

GitHub repo → **Settings → Branches → Add branch ruleset**（或 Add rule），
Target 選 `main`：

- [ ] ✅ Require a pull request before merging
- [ ] ✅ Require approvals（至少 1）
- [ ] ✅ **Require review from Code Owners** ← 這一項是關鍵，沒有它 CODEOWNERS 形同虛設
- [ ] ✅ Dismiss stale pull request approvals when new commits are pushed
- [ ] ✅ Require branches to be up to date before merging
- [ ] （建議）Do not allow bypassing the above settings（連 admin 也要守規則）
- [ ] （建議）Restrict who can push to matching branches（禁止直推 `main`）

## 步驟三：把 CI 設成 required checks

先確認 `.github/workflows/ci.yml` 會跑 `lint / typecheck / test / build`
（`AGENTS.md` 已載明四關）。然後在同一個 branch ruleset：

- [ ] ✅ Require status checks to pass before merging
- [ ] 勾選這四個 check：`lint`、`typecheck`、`test`、`build`
      （名稱需與 workflow job 名一致；跑過一次 PR 後才會出現在清單中）

## 步驟四：驗收

- [ ] 開一個測試 PR 去改 `apps/api/prisma/schema.prisma`，確認 GitHub **自動要求
      `@schema-owner`（真人）審查**，且未審查前無法 merge。
- [ ] 故意讓某個 check 失敗（如改壞 lint），確認 PR **被擋住無法合併**。
- [ ] 嘗試直接 push 到 `main`，確認被拒絕。

三項都符合預期 → 權限已真正鎖在人手上。

## 與 AI agent 的關係

- `CLAUDE.md` 的反模式清單約束的是 **AI agent 的自律**（看到改 schema / 加套件就停下來問）。
- 本清單約束的是 **平台層的強制力**（GitHub 擋 merge）。
- 兩者互補：agent 自律降低出錯機率，branch protection 是最後一道防線。
- **任何 AI agent（含 Claude Code）都無法繞過 branch protection**——這正是把控制權留在人手上的設計。
