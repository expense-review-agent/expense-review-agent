-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('REVIEWER', 'SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'QUEUED', 'AWAITING_INFO', 'DISPOSED', 'REVIEW_CLOSED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('RECEIPT', 'EXPENSE_FORM', 'POLICY', 'ATTACHMENT');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('APPROVAL_RECORD', 'CONTRACT', 'PARTICIPANT_LIST', 'TRIP_ITINERARY', 'QUOTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "PolicyVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PolicyResolution" AS ENUM ('EXACT', 'FALLBACK_BOOTSTRAP');

-- CreateEnum
CREATE TYPE "RuleLayer" AS ENUM ('MATCH', 'RULE');

-- CreateEnum
CREATE TYPE "ExtractionSource" AS ENUM ('STRUCTURED_FIXTURE', 'MANUAL_FORM', 'OCR');

-- CreateEnum
CREATE TYPE "ReviewRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "Classification" AS ENUM ('NORMAL', 'EXCEPTION', 'MISSING', 'HUMAN');

-- CreateEnum
CREATE TYPE "RecommendedAction" AS ENUM ('APPROVE', 'REQUEST_INFO', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NONE');

-- CreateEnum
CREATE TYPE "TriggerStage" AS ENUM ('UPLOAD', 'EXTRACTION', 'MATCHING', 'RULES', 'CLASSIFICATION');

-- CreateEnum
CREATE TYPE "RuleOutcome" AS ENUM ('PASS', 'FAIL', 'GATED', 'ABSTAIN', 'PENDING_HUMAN');

-- CreateEnum
CREATE TYPE "AbstainReason" AS ENUM ('RULE_NOT_APPLICABLE', 'BEYOND_CAPABILITY', 'LOW_CONFIDENCE', 'UNSUPPORTED_CURRENCY');

-- CreateEnum
CREATE TYPE "EvaluationBasis" AS ENUM ('SINGLE', 'DECLARED_ONLY', 'RECEIPT_ONLY', 'BOTH_AGREE', 'DIVERGENT');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "MatchScope" AS ENUM ('LINE_FIELD', 'TOTAL_SUM', 'LINE_COUNT', 'UNMATCHED_RECEIPT', 'MISSING_RECEIPT');

-- CreateEnum
CREATE TYPE "MatchOutcome" AS ENUM ('MATCHED', 'MISMATCHED', 'MISSING', 'UNMATCHED');

-- CreateEnum
CREATE TYPE "MatchVerdict" AS ENUM ('CONSISTENT', 'PARTIAL', 'INCONSISTENT');

-- CreateEnum
CREATE TYPE "ReviewerAction" AS ENUM ('ACCEPT', 'REQUEST_INFO', 'MANUAL_JUDGEMENT', 'HOLD');

-- CreateEnum
CREATE TYPE "ConsistencyFlag" AS ENUM ('CONSISTENT', 'OVERRIDDEN', 'HUMAN_ASSUMED', 'ESCALATED', 'REASON_MISSING');

-- CreateEnum
CREATE TYPE "SupervisorAction" AS ENUM ('APPROVE', 'RETURN_TO_REVIEWER', 'MARK_REVIEWED', 'FLAG_CONCERN', 'ANNOTATE');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('CASE_CREATED', 'DOCUMENT_UPLOADED', 'DOCUMENT_REMOVED', 'CASE_SUBMITTED', 'POLICY_VERSION_LOCKED', 'RUN_STARTED', 'RUN_COMPLETED', 'RUN_FAILED', 'REVIEWER_DISPOSITION', 'SUPERVISOR_REVIEW', 'CASE_STATUS_CHANGED', 'AUDIT_EXPORTED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'REVIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyTaxId" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyTaxId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "pageCount" INTEGER,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "descKey" TEXT,
    "layer" "RuleLayer" NOT NULL,
    "dependsOnConsistency" BOOLEAN NOT NULL DEFAULT false,
    "isSuspicionOnly" BOOLEAN NOT NULL DEFAULT false,
    "isGuardrail" BOOLEAN NOT NULL DEFAULT false,
    "paramsSchemaKey" TEXT,
    "messageKeyPrefix" TEXT NOT NULL,
    "defaultSeverity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "tier" INTEGER NOT NULL DEFAULT 0,
    "engineMinVersion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RuleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyVersion" (
    "id" TEXT NOT NULL,
    "policyDocumentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "PolicyVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isBootstrap" BOOLEAN NOT NULL DEFAULT false,
    "sourceFileId" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyRule" (
    "id" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "ruleDefinitionId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "clauseRef" TEXT,
    "clauseText" TEXT NOT NULL,
    "clauseAnchor" JSONB,
    "params" JSONB NOT NULL DEFAULT '{}',
    "severityOverride" "Severity",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PolicyRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'DRAFT',
    "applicantName" TEXT NOT NULL,
    "applicantCode" TEXT,
    "applicationDate" DATE,
    "declaredTotal" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "policyVersionId" TEXT,
    "currentRunId" TEXT,
    "riskScore" INTEGER,
    "roundCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseDocument" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "attachmentType" "AttachmentType",
    "isBundle" BOOLEAN NOT NULL DEFAULT false,
    "round" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseLine" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "docNo" TEXT,
    "expenseDate" DATE,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TWD',
    "vendor" TEXT,
    "category" TEXT,
    "description" TEXT,
    "approvalRef" TEXT,
    "approvedBy" TEXT,
    "costAllocations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "documentId" TEXT,
    "pageIndex" INTEGER,
    "extractionSource" "ExtractionSource" NOT NULL DEFAULT 'STRUCTURED_FIXTURE',
    "docNo" TEXT,
    "issueDate" DATE,
    "amount" DECIMAL(14,2),
    "currency" TEXT,
    "vendor" TEXT,
    "category" TEXT,
    "buyerTaxId" TEXT,
    "sellerTaxId" TEXT,
    "taxAmount" DECIMAL(14,2),
    "minConfidenceScore" DECIMAL(5,4),
    "minConfidenceLevel" "ConfidenceLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "rawText" TEXT,
    "normalizedValue" TEXT,
    "isRecognized" BOOLEAN NOT NULL DEFAULT true,
    "confidenceScore" DECIMAL(5,4),
    "confidenceLevel" "ConfidenceLevel" NOT NULL DEFAULT 'NONE',
    "anchor" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractedField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptLineLink" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "matchScore" DECIMAL(5,4),
    "matchedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptLineLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRun" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "roundNo" INTEGER NOT NULL,
    "status" "ReviewRunStatus" NOT NULL DEFAULT 'PENDING',
    "policyVersionId" TEXT,
    "policyResolution" "PolicyResolution",
    "engineVersion" TEXT NOT NULL,
    "extractionSource" "ExtractionSource" NOT NULL DEFAULT 'STRUCTURED_FIXTURE',
    "inputSnapshot" JSONB,
    "snapshotHash" TEXT,
    "matchVerdict" "MatchVerdict",
    "declaredCount" INTEGER,
    "receiptCount" INTEGER,
    "sumDifference" DECIMAL(14,2),
    "classification" "Classification",
    "recommendedAction" "RecommendedAction",
    "triggerStage" "TriggerStage",
    "summaryKey" TEXT,
    "summaryParams" JSONB,
    "confidenceScore" DECIMAL(5,4),
    "confidenceLevel" "ConfidenceLevel",
    "abstainReason" "AbstainReason",
    "riskScore" INTEGER,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "scope" "MatchScope" NOT NULL,
    "outcome" "MatchOutcome" NOT NULL,
    "lineId" TEXT,
    "receiptId" TEXT,
    "fieldKey" TEXT,
    "declaredValue" TEXT,
    "receiptValue" TEXT,
    "diffAmount" DECIMAL(14,2),
    "messageKey" TEXT,
    "messageParams" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleResult" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "checkKey" TEXT NOT NULL,
    "ruleDefinitionId" TEXT,
    "policyRuleId" TEXT,
    "ruleCode" TEXT NOT NULL,
    "outcome" "RuleOutcome" NOT NULL,
    "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
    "messageKey" TEXT NOT NULL,
    "messageParams" JSONB,
    "evaluationBasis" "EvaluationBasis" NOT NULL DEFAULT 'SINGLE',
    "outcomeByDeclared" "RuleOutcome",
    "outcomeByReceipt" "RuleOutcome",
    "gateReasonKey" TEXT,
    "gatedByMatchId" TEXT,
    "abstainReason" "AbstainReason",
    "evaluationDetail" JSONB,
    "confidenceScore" DECIMAL(5,4),
    "confidenceLevel" "ConfidenceLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "ruleResultId" TEXT,
    "matchResultId" TEXT,
    "receiptId" TEXT,
    "extractedFieldId" TEXT,
    "policyRuleId" TEXT,
    "relatedCaseId" TEXT,
    "snippet" TEXT,
    "anchor" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disposition" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "ReviewerAction" NOT NULL,
    "agentClassificationAtDecision" "Classification",
    "agentActionAtDecision" "RecommendedAction",
    "finalClassification" "Classification",
    "finalAction" "RecommendedAction",
    "consistencyFlag" "ConsistencyFlag" NOT NULL,
    "reason" TEXT,
    "resultingStatus" "CaseStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Disposition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisorReview" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "SupervisorAction" NOT NULL,
    "comment" TEXT,
    "resultingStatus" "CaseStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupervisorReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" "AuditEventType" NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "runId" TEXT,
    "policyVersionId" TEXT,
    "payload" JSONB NOT NULL,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditExport" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileId" TEXT,
    "chainHead" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_organizationId_role_idx" ON "User"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyTaxId_organizationId_taxId_key" ON "CompanyTaxId"("organizationId", "taxId");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_storageKey_key" ON "StoredFile"("storageKey");

-- CreateIndex
CREATE INDEX "StoredFile_sha256_idx" ON "StoredFile"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "RuleDefinition_code_key" ON "RuleDefinition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyDocument_organizationId_name_key" ON "PolicyDocument"("organizationId", "name");

-- CreateIndex
CREATE INDEX "PolicyVersion_status_effectiveFrom_idx" ON "PolicyVersion"("status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyVersion_policyDocumentId_version_key" ON "PolicyVersion"("policyDocumentId", "version");

-- CreateIndex
CREATE INDEX "PolicyRule_policyVersionId_isActive_idx" ON "PolicyRule"("policyVersionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyRule_policyVersionId_ruleKey_key" ON "PolicyRule"("policyVersionId", "ruleKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCase_currentRunId_key" ON "ExpenseCase"("currentRunId");

-- CreateIndex
CREATE INDEX "ExpenseCase_organizationId_status_idx" ON "ExpenseCase"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ExpenseCase_organizationId_status_riskScore_idx" ON "ExpenseCase"("organizationId", "status", "riskScore");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCase_organizationId_caseNumber_key" ON "ExpenseCase"("organizationId", "caseNumber");

-- CreateIndex
CREATE INDEX "CaseDocument_caseId_kind_idx" ON "CaseDocument"("caseId", "kind");

-- CreateIndex
CREATE INDEX "ExpenseLine_caseId_idx" ON "ExpenseLine"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseLine_caseId_lineNo_key" ON "ExpenseLine"("caseId", "lineNo");

-- CreateIndex
CREATE INDEX "Receipt_caseId_idx" ON "Receipt"("caseId");

-- CreateIndex
CREATE INDEX "Receipt_caseId_docNo_idx" ON "Receipt"("caseId", "docNo");

-- CreateIndex
CREATE UNIQUE INDEX "ExtractedField_receiptId_fieldKey_key" ON "ExtractedField"("receiptId", "fieldKey");

-- CreateIndex
CREATE INDEX "ReceiptLineLink_runId_idx" ON "ReceiptLineLink"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptLineLink_runId_lineId_receiptId_key" ON "ReceiptLineLink"("runId", "lineId", "receiptId");

-- CreateIndex
CREATE INDEX "ReviewRun_caseId_status_idx" ON "ReviewRun"("caseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRun_caseId_roundNo_key" ON "ReviewRun"("caseId", "roundNo");

-- CreateIndex
CREATE INDEX "MatchResult_runId_scope_idx" ON "MatchResult"("runId", "scope");

-- CreateIndex
CREATE INDEX "RuleResult_runId_outcome_idx" ON "RuleResult"("runId", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "RuleResult_runId_checkKey_key" ON "RuleResult"("runId", "checkKey");

-- CreateIndex
CREATE INDEX "Evidence_ruleResultId_idx" ON "Evidence"("ruleResultId");

-- CreateIndex
CREATE INDEX "Evidence_matchResultId_idx" ON "Evidence"("matchResultId");

-- CreateIndex
CREATE INDEX "Evidence_relatedCaseId_idx" ON "Evidence"("relatedCaseId");

-- CreateIndex
CREATE INDEX "Disposition_caseId_createdAt_idx" ON "Disposition"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "Disposition_runId_idx" ON "Disposition"("runId");

-- CreateIndex
CREATE INDEX "Disposition_consistencyFlag_idx" ON "Disposition"("consistencyFlag");

-- CreateIndex
CREATE INDEX "SupervisorReview_caseId_createdAt_idx" ON "SupervisorReview"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "SupervisorReview_action_idx" ON "SupervisorReview"("action");

-- CreateIndex
CREATE INDEX "AuditEvent_caseId_createdAt_idx" ON "AuditEvent"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_type_idx" ON "AuditEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_caseId_seq_key" ON "AuditEvent"("caseId", "seq");

-- CreateIndex
CREATE INDEX "AuditExport_caseId_idx" ON "AuditExport"("caseId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyTaxId" ADD CONSTRAINT "CompanyTaxId_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyDocument" ADD CONSTRAINT "PolicyDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_policyDocumentId_fkey" FOREIGN KEY ("policyDocumentId") REFERENCES "PolicyDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyVersion" ADD CONSTRAINT "PolicyVersion_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRule" ADD CONSTRAINT "PolicyRule_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRule" ADD CONSTRAINT "PolicyRule_ruleDefinitionId_fkey" FOREIGN KEY ("ruleDefinitionId") REFERENCES "RuleDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCase" ADD CONSTRAINT "ExpenseCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCase" ADD CONSTRAINT "ExpenseCase_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCase" ADD CONSTRAINT "ExpenseCase_currentRunId_fkey" FOREIGN KEY ("currentRunId") REFERENCES "ReviewRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDocument" ADD CONSTRAINT "CaseDocument_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDocument" ADD CONSTRAINT "CaseDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseLine" ADD CONSTRAINT "ExpenseLine_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CaseDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptLineLink" ADD CONSTRAINT "ReceiptLineLink_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReviewRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptLineLink" ADD CONSTRAINT "ReceiptLineLink_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ExpenseLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptLineLink" ADD CONSTRAINT "ReceiptLineLink_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRun" ADD CONSTRAINT "ReviewRun_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRun" ADD CONSTRAINT "ReviewRun_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReviewRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "ExpenseLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleResult" ADD CONSTRAINT "RuleResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReviewRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleResult" ADD CONSTRAINT "RuleResult_ruleDefinitionId_fkey" FOREIGN KEY ("ruleDefinitionId") REFERENCES "RuleDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleResult" ADD CONSTRAINT "RuleResult_policyRuleId_fkey" FOREIGN KEY ("policyRuleId") REFERENCES "PolicyRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleResult" ADD CONSTRAINT "RuleResult_gatedByMatchId_fkey" FOREIGN KEY ("gatedByMatchId") REFERENCES "MatchResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_ruleResultId_fkey" FOREIGN KEY ("ruleResultId") REFERENCES "RuleResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_matchResultId_fkey" FOREIGN KEY ("matchResultId") REFERENCES "MatchResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_extractedFieldId_fkey" FOREIGN KEY ("extractedFieldId") REFERENCES "ExtractedField"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_policyRuleId_fkey" FOREIGN KEY ("policyRuleId") REFERENCES "PolicyRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_relatedCaseId_fkey" FOREIGN KEY ("relatedCaseId") REFERENCES "ExpenseCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disposition" ADD CONSTRAINT "Disposition_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disposition" ADD CONSTRAINT "Disposition_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReviewRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disposition" ADD CONSTRAINT "Disposition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorReview" ADD CONSTRAINT "SupervisorReview_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisorReview" ADD CONSTRAINT "SupervisorReview_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReviewRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditExport" ADD CONSTRAINT "AuditExport_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ExpenseCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditExport" ADD CONSTRAINT "AuditExport_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditExport" ADD CONSTRAINT "AuditExport_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "StoredFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
