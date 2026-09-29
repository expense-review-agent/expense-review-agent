-- CreateEnum
CREATE TYPE "ReadingOutcome" AS ENUM ('SUCCEEDED', 'FAILED');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'RECEIPT_READING';

-- CreateTable
CREATE TABLE "ReceiptReading" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptReadingOutcome" (
    "id" TEXT NOT NULL,
    "readingId" TEXT NOT NULL,
    "outcome" "ReadingOutcome" NOT NULL,
    "rawResponses" JSONB NOT NULL DEFAULT '[]',
    "extractions" JSONB,
    "amountChecks" JSONB,
    "failureReason" TEXT,
    "usage" JSONB,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptReadingOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptReading_caseId_startedAt_idx" ON "ReceiptReading"("caseId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptReadingOutcome_readingId_key" ON "ReceiptReadingOutcome"("readingId");

-- AddForeignKey
ALTER TABLE "ReceiptReading" ADD CONSTRAINT "ReceiptReading_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptReadingOutcome" ADD CONSTRAINT "ReceiptReadingOutcome_readingId_fkey" FOREIGN KEY ("readingId") REFERENCES "ReceiptReading"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- Governance（說明見 ../GOVERNANCE_SQL.md 第 6 點）
-- =====================================================================

-- 讀取紀錄只能新增（deny_mutation / deny_truncate 定義於 governance migration）
CREATE TRIGGER "ReceiptReading_immutable"
  BEFORE UPDATE OR DELETE ON "ReceiptReading"
  FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TRIGGER "ReceiptReading_no_truncate"
  BEFORE TRUNCATE ON "ReceiptReading"
  FOR EACH STATEMENT EXECUTE FUNCTION deny_truncate();
CREATE TRIGGER "ReceiptReadingOutcome_immutable"
  BEFORE UPDATE OR DELETE ON "ReceiptReadingOutcome"
  FOR EACH ROW EXECUTE FUNCTION deny_mutation();
CREATE TRIGGER "ReceiptReadingOutcome_no_truncate"
  BEFORE TRUNCATE ON "ReceiptReadingOutcome"
  FOR EACH STATEMENT EXECUTE FUNCTION deny_truncate();

-- 每次讀取至少送出一張憑證
ALTER TABLE "ReceiptReading"
  ADD CONSTRAINT receipt_reading_has_inputs
  CHECK (jsonb_typeof("inputs") = 'array' AND jsonb_array_length("inputs") > 0);

-- 成功必須有擷取結果與金額比對；失敗必須有原因，且不得留下部分結果（spec 4.8）
ALTER TABLE "ReceiptReadingOutcome"
  ADD CONSTRAINT receipt_reading_outcome_consistent
  CHECK (
    (
      "outcome" = 'SUCCEEDED'
      AND "extractions" IS NOT NULL
      AND "amountChecks" IS NOT NULL
      AND "failureReason" IS NULL
    )
    OR (
      "outcome" = 'FAILED'
      AND "extractions" IS NULL
      AND "amountChecks" IS NULL
      AND "failureReason" IS NOT NULL
      AND length(btrim("failureReason")) > 0
    )
  );
ALTER TABLE "ReceiptReadingOutcome"
  ADD CONSTRAINT receipt_reading_raw_is_array
  CHECK (jsonb_typeof("rawResponses") = 'array');
