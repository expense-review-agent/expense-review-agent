-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('PENDING', 'AWAITING_INFO', 'REVIEW_COMPLETED');

-- CreateEnum
CREATE TYPE "Recommendation" AS ENUM ('APPROVE', 'REQUEST_INFO', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "ReviewDimension" AS ENUM ('EVIDENCE_MATCH', 'CORPORATE_POLICY', 'COMPLIANCE', 'RISK_SIGNAL');

-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('PASS', 'FAIL', 'UNDETERMINED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "FindingKind" AS ENUM ('MISSING', 'ANOMALY', 'UNDETERMINED');

-- CreateEnum
CREATE TYPE "WorkflowAction" AS ENUM ('PROCEED', 'REQUEST_INFO');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('AGENT', 'HUMAN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('PRESET');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('CASE_CREATED', 'REVIEW_RECORDED', 'WORKFLOW_ACTION');

-- CreateTable
CREATE TABLE "ExpenseCase" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'PENDING',
    "applicantName" TEXT NOT NULL,
    "employeeId" TEXT,
    "department" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "expenseDate" DATE NOT NULL,
    "submittedAt" DATE,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "scenario" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseLine" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "lineKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expenseDate" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "netAmount" DECIMAL(14,2),
    "taxAmount" DECIMAL(14,2),

    CONSTRAINT "ExpenseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "receiptKey" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "issueDate" DATE NOT NULL,
    "hasTaxId" BOOLEAN NOT NULL,
    "imagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseLineReceipt" (
    "lineId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,

    CONSTRAINT "ExpenseLineReceipt_pkey" PRIMARY KEY ("lineId","receiptId")
);

-- CreateTable
CREATE TABLE "ReviewRecord" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "reviewKey" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "recommendation" "Recommendation" NOT NULL,
    "source" "ReviewSource" NOT NULL,
    "engineVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewReceipt" (
    "reviewId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,

    CONSTRAINT "ReviewReceipt_pkey" PRIMARY KEY ("reviewId","receiptId")
);

-- CreateTable
CREATE TABLE "CheckResult" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "dimension" "ReviewDimension" NOT NULL,
    "status" "CheckStatus" NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "CheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "findingKey" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "dimension" "ReviewDimension" NOT NULL,
    "kind" "FindingKind" NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "ruleCode" TEXT,
    "ruleText" TEXT NOT NULL,
    "comparison" JSONB NOT NULL DEFAULT '[]',
    "relatedCaseNumber" TEXT,
    "nextStep" TEXT,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowActionRecord" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "action" "WorkflowAction" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "originalRecommendation" "Recommendation" NOT NULL,
    "resultingStatus" "CaseStatus" NOT NULL,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowActionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" "AuditEventType" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCase_caseNumber_key" ON "ExpenseCase"("caseNumber");

-- CreateIndex
CREATE INDEX "ExpenseCase_status_idx" ON "ExpenseCase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseLine_caseId_lineNo_key" ON "ExpenseLine"("caseId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseLine_caseId_lineKey_key" ON "ExpenseLine"("caseId", "lineKey");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptKey_key" ON "Receipt"("receiptKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRecord_reviewKey_key" ON "ReviewRecord"("reviewKey");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRecord_caseId_seq_key" ON "ReviewRecord"("caseId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "CheckResult_reviewId_dimension_key" ON "CheckResult"("reviewId", "dimension");

-- CreateIndex
CREATE UNIQUE INDEX "Finding_reviewId_findingKey_key" ON "Finding"("reviewId", "findingKey");

-- CreateIndex
CREATE UNIQUE INDEX "Finding_reviewId_orderIndex_key" ON "Finding"("reviewId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowActionRecord_reviewId_key" ON "WorkflowActionRecord"("reviewId");

-- CreateIndex
CREATE INDEX "WorkflowActionRecord_caseId_idx" ON "WorkflowActionRecord"("caseId");

-- CreateIndex
CREATE INDEX "AuditEvent_caseId_createdAt_idx" ON "AuditEvent"("caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_caseId_seq_key" ON "AuditEvent"("caseId", "seq");

-- AddForeignKey
ALTER TABLE "ExpenseLine" ADD CONSTRAINT "ExpenseLine_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseLineReceipt" ADD CONSTRAINT "ExpenseLineReceipt_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ExpenseLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseLineReceipt" ADD CONSTRAINT "ExpenseLineReceipt_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRecord" ADD CONSTRAINT "ReviewRecord_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReceipt" ADD CONSTRAINT "ReviewReceipt_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ReviewRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReceipt" ADD CONSTRAINT "ReviewReceipt_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckResult" ADD CONSTRAINT "CheckResult_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ReviewRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ReviewRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowActionRecord" ADD CONSTRAINT "WorkflowActionRecord_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowActionRecord" ADD CONSTRAINT "WorkflowActionRecord_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ReviewRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
