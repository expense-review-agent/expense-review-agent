-- =====================================================================
-- Governance constraints for schema v4
-- 說明見 ../GOVERNANCE_SQL.md。這些是治理保證，不是可選項：
-- 應用層也會先驗證並回傳友善錯誤，但資料庫是最後一道防線。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) append-only：審查紀錄、檢核結果、發現項目、憑證快照、流程動作、稽核事件
--    禁止 UPDATE / DELETE / TRUNCATE。重置資料一律 db:reset（DROP SCHEMA 重建）。
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION deny_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table: % is immutable', TG_TABLE_NAME;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION deny_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table: % cannot be truncated', TG_TABLE_NAME;
END; $$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ReviewRecord', 'CheckResult', 'Finding', 'ReviewReceipt',
    'WorkflowActionRecord', 'AuditEvent'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION deny_mutation()',
      t || '_immutable', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION deny_truncate()',
      t || '_no_truncate', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 2) 每個 Finding 都要能回溯到判斷依據；數值對照必須是陣列
-- ---------------------------------------------------------------------
ALTER TABLE "Finding"
  ADD CONSTRAINT finding_requires_rule
  CHECK (length(btrim("ruleText")) > 0);
ALTER TABLE "Finding"
  ADD CONSTRAINT finding_comparison_is_array
  CHECK (jsonb_typeof("comparison") = 'array');

-- ---------------------------------------------------------------------
-- 3) 流程動作：理由必填規則、動作與結果狀態一致
--    只有「建議通過」的案件完成初審可以不填理由；退回補件一律要有補件內容。
-- ---------------------------------------------------------------------
ALTER TABLE "WorkflowActionRecord"
  ADD CONSTRAINT workflow_action_reason_required
  CHECK (
    ("action" = 'PROCEED' AND "originalRecommendation" = 'APPROVE')
    OR length(btrim("reason")) > 0
  );
ALTER TABLE "WorkflowActionRecord"
  ADD CONSTRAINT workflow_action_resulting_status
  CHECK (
    ("action" = 'PROCEED' AND "resultingStatus" = 'REVIEW_COMPLETED')
    OR ("action" = 'REQUEST_INFO' AND "resultingStatus" = 'AWAITING_INFO')
  );

-- ---------------------------------------------------------------------
-- 4) 流程動作只能處理該案件的最新審查紀錄，且原始建議快照必須與該紀錄一致
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION workflow_action_targets_latest_review() RETURNS trigger AS $$
DECLARE
  latest RECORD;
BEGIN
  SELECT "id", "recommendation" INTO latest
    FROM "ReviewRecord"
   WHERE "caseId" = NEW."caseId"
   ORDER BY "seq" DESC
   LIMIT 1;
  IF latest."id" IS NULL OR latest."id" <> NEW."reviewId" THEN
    RAISE EXCEPTION 'workflow action must target the latest review record of its case';
  END IF;
  IF latest."recommendation" <> NEW."originalRecommendation" THEN
    RAISE EXCEPTION 'originalRecommendation must match the reviewed recommendation';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_action_latest_review
  BEFORE INSERT ON "WorkflowActionRecord"
  FOR EACH ROW EXECUTE FUNCTION workflow_action_targets_latest_review();

-- ---------------------------------------------------------------------
-- 5) 本輪只支援 TWD；金額不得為負
-- ---------------------------------------------------------------------
ALTER TABLE "ExpenseCase"
  ADD CONSTRAINT expense_case_twd_only CHECK ("currency" = 'TWD');
ALTER TABLE "ExpenseCase"
  ADD CONSTRAINT expense_case_amount_non_negative CHECK ("amount" >= 0);
ALTER TABLE "ExpenseLine"
  ADD CONSTRAINT expense_line_amounts_non_negative
  CHECK ("amount" >= 0 AND COALESCE("netAmount", 0) >= 0 AND COALESCE("taxAmount", 0) >= 0);
ALTER TABLE "Receipt"
  ADD CONSTRAINT receipt_amount_non_negative CHECK ("amount" >= 0);
