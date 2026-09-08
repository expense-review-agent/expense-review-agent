-- =====================================================================
-- Governance constraints (tasks §2.2–§2.5)
-- Source of truth: apps/api/prisma/schema.prisma trailer + GOVERNANCE_SQL.md
-- These are治理保證, not optional — CLAUDE.md 領域規則第 2、5 條依賴它們。
-- Column names verified against 20260908054344_init_m1_schema_v3.
-- Note: schema uses TIMESTAMP(3) (no tz) -> use tsrange (not tstzrange).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) append-only 保證：AuditEvent / Disposition / SupervisorReview
--    禁止 UPDATE 與 DELETE。seed reset 走 DROP SCHEMA 重建（見 db:reset）。
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 2) 需要理由的處置不得留白（M1-U2 AC10）
-- ---------------------------------------------------------------------
ALTER TABLE "Disposition"
  ADD CONSTRAINT disposition_reason_required
  CHECK (
    "consistencyFlag" NOT IN ('OVERRIDDEN', 'HUMAN_ASSUMED')
    OR ("reason" IS NOT NULL AND length(btrim("reason")) > 0)
  );

-- ---------------------------------------------------------------------
-- 3) 主管有疑慮必附意見（M1-U2 AC6）
-- ---------------------------------------------------------------------
ALTER TABLE "SupervisorReview"
  ADD CONSTRAINT supervisor_concern_requires_comment
  CHECK (
    "action" <> 'FLAG_CONCERN'
    OR ("comment" IS NOT NULL AND length(btrim("comment")) > 0)
  );

-- ---------------------------------------------------------------------
-- 4) Evidence 至少掛在一個結論上（CLAUDE.md 領域規則第 2 條）
--    非通過的 RuleResult / MatchResult 沒有 Evidence 就是 bug。
-- ---------------------------------------------------------------------
ALTER TABLE "Evidence"
  ADD CONSTRAINT evidence_requires_parent
  CHECK ("ruleResultId" IS NOT NULL OR "matchResultId" IS NOT NULL);

-- ---------------------------------------------------------------------
-- 5) GATED 與 ABSTAIN 必附原因（B4 / Guardrail）
-- ---------------------------------------------------------------------
ALTER TABLE "RuleResult"
  ADD CONSTRAINT rule_result_gate_requires_reason
  CHECK ("outcome" <> 'GATED' OR "gateReasonKey" IS NOT NULL);
ALTER TABLE "RuleResult"
  ADD CONSTRAINT rule_result_abstain_requires_reason
  CHECK ("outcome" <> 'ABSTAIN' OR "abstainReason" IS NOT NULL);

-- ---------------------------------------------------------------------
-- 6) 每個 PolicyDocument 至多一個冷啟動預設版本
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX policy_version_single_bootstrap
  ON "PolicyVersion" ("policyDocumentId")
  WHERE "isBootstrap" = true;

-- ---------------------------------------------------------------------
-- 7) 同一 PolicyDocument 的 ACTIVE 版本生效區間不得重疊
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "PolicyVersion"
  ADD CONSTRAINT policy_version_no_overlap
  EXCLUDE USING gist (
    "policyDocumentId" WITH =,
    tsrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::timestamp)) WITH &&
  ) WHERE ("status" = 'ACTIVE');
