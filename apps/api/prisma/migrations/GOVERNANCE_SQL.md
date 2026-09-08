# 治理 SQL — 併入初始 migration（tasks §2.2–§2.5）

> **這不是自動套用的檔案。** 它是 `bootstrap-m1-foundation` §2 的實作素材。
> 步驟：先跑 `pnpm --filter api prisma:migrate` 產生 `init_m1_schema_v3`
> 的 `migration.sql`（表/enum/index DDL），**然後把下面整段 SQL 貼到那個
> `migration.sql` 檔尾**，再 commit。
>
> 來源：`apps/api/prisma/schema.prisma` 檔尾的治理清單（逐字對應）。
> 這些是「治理保證」，不是可選項——`CLAUDE.md` 領域規則第 2、5 條依賴它們。

```sql
-- =====================================================================
-- 1) append-only 保證：AuditEvent / Disposition / SupervisorReview
--    禁止 UPDATE 與 DELETE。seed reset 用 DROP SCHEMA 重建（見 db:reset）。
-- =====================================================================
CREATE OR REPLACE FUNCTION deny_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table: % is immutable', TG_TABLE_NAME;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER audit_event_immutable
  BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TRIGGER disposition_immutable
  BEFORE UPDATE OR DELETE ON "Disposition"
  FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TRIGGER supervisor_review_immutable
  BEFORE UPDATE OR DELETE ON "SupervisorReview"
  FOR EACH ROW EXECUTE FUNCTION deny_mutation();

-- =====================================================================
-- 2) 需要理由的處置不得留白（M1-U2 AC10）
-- =====================================================================
ALTER TABLE "Disposition"
  ADD CONSTRAINT disposition_reason_required
  CHECK (
    "consistencyFlag" NOT IN ('OVERRIDDEN', 'HUMAN_ASSUMED')
    OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0)
  );

-- =====================================================================
-- 3) 主管有疑慮必附意見（M1-U2 AC6）
-- =====================================================================
ALTER TABLE "SupervisorReview"
  ADD CONSTRAINT supervisor_concern_requires_comment
  CHECK (
    "action" <> 'FLAG_CONCERN'
    OR ("comment" IS NOT NULL AND length(btrim("comment")) > 0)
  );

-- =====================================================================
-- 4) Evidence 至少掛在一個結論上（CLAUDE.md 領域規則第 2 條）
--    非通過的 RuleResult / MatchResult 沒有 Evidence 就是 bug。
-- =====================================================================
ALTER TABLE "Evidence"
  ADD CONSTRAINT evidence_requires_parent
  CHECK ("ruleResultId" IS NOT NULL OR "matchResultId" IS NOT NULL);

-- =====================================================================
-- 5) GATED 與 ABSTAIN 必附原因（B4 / Guardrail）
-- =====================================================================
ALTER TABLE "RuleResult"
  ADD CONSTRAINT rule_result_gate_requires_reason
  CHECK ("outcome" <> 'GATED' OR "gateReasonKey" IS NOT NULL);
ALTER TABLE "RuleResult"
  ADD CONSTRAINT rule_result_abstain_requires_reason
  CHECK ("outcome" <> 'ABSTAIN' OR "abstainReason" IS NOT NULL);

-- =====================================================================
-- 6) 每個 PolicyDocument 至多一個冷啟動預設版本
-- =====================================================================
CREATE UNIQUE INDEX policy_version_single_bootstrap
  ON "PolicyVersion" ("policyDocumentId")
  WHERE "isBootstrap" = true;

-- =====================================================================
-- 7) 同一 PolicyDocument 的 ACTIVE 版本生效區間不得重疊
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "PolicyVersion"
  ADD CONSTRAINT policy_version_no_overlap
  EXCLUDE USING gist (
    "policyDocumentId" WITH =,
    tstzrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::timestamptz)) WITH &&
  ) WHERE ("status" = 'ACTIVE');
```

## 驗證（§2.2–§2.6）

套用 migration 後，用 `psql` 逐項確認：

```sql
-- append-only：應各自 RAISE EXCEPTION
UPDATE "AuditEvent" SET seq = seq WHERE false;      -- 觸發 trigger（即使 0 rows 也應報錯前先檢查語法）
DELETE FROM "Disposition" WHERE id = '__none__';    -- 應報 append-only 錯誤

-- evidence-required：無父節點的 Evidence 應被拒
INSERT INTO "Evidence" (id, "createdAt") VALUES ('x', now());  -- 應違反 evidence_requires_parent

-- GATED 無 gateReasonKey 應被拒（示意，實際欄位以 schema 為準）
```

冪等性（§2.6）：

```bash
pnpm --filter api prisma:migrate   # 第一次：建立
pnpm --filter api prisma:migrate   # 第二次：應報 "No pending migrations" / up to date
```
