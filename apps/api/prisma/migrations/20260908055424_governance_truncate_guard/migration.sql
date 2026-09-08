-- =====================================================================
-- Governance: TRUNCATE guard on append-only tables
--
-- The row-level deny_mutation() trigger only fires FOR EACH ROW on
-- UPDATE/DELETE. TRUNCATE is a statement-level operation that bypasses
-- row triggers entirely — a real hole in the append-only guarantee.
-- This adds a statement-level BEFORE TRUNCATE trigger to close it.
--
-- Note: db:reset uses DROP SCHEMA (not TRUNCATE), so reset is unaffected.
-- =====================================================================

CREATE OR REPLACE FUNCTION deny_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'append-only table: % cannot be truncated', TG_TABLE_NAME;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER audit_event_no_truncate
  BEFORE TRUNCATE ON "AuditEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION deny_truncate();
CREATE TRIGGER disposition_no_truncate
  BEFORE TRUNCATE ON "Disposition"
  FOR EACH STATEMENT EXECUTE FUNCTION deny_truncate();
CREATE TRIGGER supervisor_review_no_truncate
  BEFORE TRUNCATE ON "SupervisorReview"
  FOR EACH STATEMENT EXECUTE FUNCTION deny_truncate();
