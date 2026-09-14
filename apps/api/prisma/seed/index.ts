// =============================================================================
// Demo seed — skeleton version (tasks §4).
// Covers org / user / policy / rule definitions + policy rules, then 4
// representative cases exercising the full chain under all governance
// constraints:
//   EXP-2026-2001  NORMAL     — all rules pass, consistent
//   EXP-2026-2002  EXCEPTION  — R7 duplicate (paired with a REVIEW_CLOSED case)
//   EXP-2026-2003  MISSING    — R4 missing required invoice, REQUEST_INFO
//   EXP-2026-2004  HUMAN      — foreign invoice, agent abstains (ABSTAIN)
// Plus one paired REVIEW_CLOSED reference case (EXP-2026-1043) for R7.
//
// Phase 1: ExtractionSource.STRUCTURED_FIXTURE — NO OCR. Simulated data only.
//
// This is the skeleton to prove the seed framework works against the live
// governance CHECK/trigger constraints. Extending to the full ten scenarios
// is mechanical follow-up work — see .claude/skills/demo-case/SKILL-2.md.
// =============================================================================

import { PrismaClient, Prisma } from "@prisma/client";
import { computeAuditHash } from "./hash-chain.ts";

const prisma = new PrismaClient();
const ENGINE_VERSION = "m1-review-engine@0.1.0";

/** Append an AuditEvent, maintaining the per-case hash chain. */
async function appendAudit(
  tx: Prisma.TransactionClient,
  chain: { caseId: string; seq: number; prevHash: string | null },
  type: string,
  payload: Prisma.InputJsonValue,
  actorLabel = "system:review-engine",
): Promise<void> {
  const createdAt = new Date();
  const seq = chain.seq + 1;
  const hash = computeAuditHash({
    prevHash: chain.prevHash,
    caseId: chain.caseId,
    seq,
    type,
    payload,
    createdAt,
  });
  await tx.auditEvent.create({
    data: {
      caseId: chain.caseId,
      seq,
      type: type as never,
      actorLabel,
      payload,
      prevHash: chain.prevHash,
      hash,
      createdAt,
    },
  });
  chain.seq = seq;
  chain.prevHash = hash;
}

async function main(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // ---- Organization + users ---------------------------------------------
    const org = await tx.organization.create({
      data: { name: "示範公司（模擬資料）" },
    });

    const reviewer = await tx.user.create({
      data: {
        organizationId: org.id,
        displayName: "初審員（模擬）",
        email: "reviewer@example.test",
        role: "REVIEWER",
      },
    });
    await tx.user.create({
      data: {
        organizationId: org.id,
        displayName: "財務主管（模擬）",
        email: "supervisor@example.test",
        role: "SUPERVISOR",
      },
    });

    // ---- Rule definitions (subset needed by the 4 cases) ------------------
    const defs = await Promise.all(
      [
        {
          code: "R1",
          nameKey: "rule.R1.name",
          layer: "RULE",
          dependsOnConsistency: true,
          messageKeyPrefix: "rule.R1",
          paramsSchemaKey: "AmountLimitParams",
        },
        {
          code: "R4",
          nameKey: "rule.R4.name",
          layer: "RULE",
          dependsOnConsistency: false,
          messageKeyPrefix: "rule.R4",
          paramsSchemaKey: "RequiredAttachmentParams",
        },
        {
          code: "R5",
          nameKey: "rule.R5.name",
          layer: "MATCH",
          dependsOnConsistency: true,
          messageKeyPrefix: "rule.R5",
        },
        {
          code: "R7",
          nameKey: "rule.R7.name",
          layer: "RULE",
          dependsOnConsistency: false,
          isSuspicionOnly: true,
          messageKeyPrefix: "rule.R7",
        },
        {
          code: "GUARD_ELIGIBILITY",
          nameKey: "rule.guard.eligibility.name",
          layer: "RULE",
          dependsOnConsistency: false,
          isGuardrail: true,
          messageKeyPrefix: "rule.guard.eligibility",
        },
      ].map((d) =>
        tx.ruleDefinition.create({
          data: {
            code: d.code,
            nameKey: d.nameKey,
            layer: d.layer as never,
            dependsOnConsistency: d.dependsOnConsistency ?? false,
            isSuspicionOnly: d.isSuspicionOnly ?? false,
            isGuardrail: d.isGuardrail ?? false,
            paramsSchemaKey: d.paramsSchemaKey ?? null,
            messageKeyPrefix: d.messageKeyPrefix,
          },
        }),
      ),
    );
    const defByCodeMap = new Map(defs.map((d) => [d.code, d]));
    const defByCode = (code: string) => {
      const d = defByCodeMap.get(code);
      if (!d) throw new Error(`RuleDefinition ${code} not seeded`);
      return d;
    };

    // ---- Policy document + bootstrap version + rules ----------------------
    const policyDoc = await tx.policyDocument.create({
      data: {
        organizationId: org.id,
        name: "費用報銷規範（模擬）",
        description: "M1 demo 用簡化版規範",
      },
    });
    const policyVersion = await tx.policyVersion.create({
      data: {
        policyDocumentId: policyDoc.id,
        version: "v0.1",
        status: "ACTIVE",
        effectiveFrom: new Date("2026-01-01"),
        isBootstrap: true,
        contentHash: "demo-content-hash-v0.1",
      },
    });

    const ruleR1 = await tx.policyRule.create({
      data: {
        policyVersionId: policyVersion.id,
        ruleDefinitionId: defByCode("R1").id,
        ruleKey: "R1-lodging",
        clauseRef: "§4.2",
        clauseText: "住宿每晚上限 NT$4,000",
        params: { limit: "4000", category: "住宿" },
      },
    });
    const ruleR4 = await tx.policyRule.create({
      data: {
        policyVersionId: policyVersion.id,
        ruleDefinitionId: defByCode("R4").id,
        ruleKey: "R4-invoice",
        clauseRef: "§2.1",
        clauseText: "單筆金額 ≥ NT$5,000 須附正式發票",
        params: { threshold: "5000", requires: ["INVOICE"] },
      },
    });
    const ruleR7 = await tx.policyRule.create({
      data: {
        policyVersionId: policyVersion.id,
        ruleDefinitionId: defByCode("R7").id,
        ruleKey: "R7-duplicate",
        clauseRef: "§3.4",
        clauseText: "同單號＋同額＋同日 視為疑似重複",
        params: {},
      },
    });

    // ---- Paired REVIEW_CLOSED reference case for R7 -----------------------
    const refCase = await tx.expenseCase.create({
      data: {
        organizationId: org.id,
        caseNumber: "EXP-2026-1043",
        status: "REVIEW_CLOSED",
        applicantName: "李美華",
        applicationDate: new Date("2026-08-05"),
        declaredTotal: new Prisma.Decimal("3500"),
        policyVersionId: policyVersion.id,
        closedAt: new Date("2026-08-06"),
      },
    });

    // Helper to create one case with a run, then return ids for follow-up rows.
    async function makeCase(opts: {
      caseNumber: string;
      applicantName: string;
      status: "DRAFT" | "QUEUED" | "AWAITING_INFO" | "DISPOSED" | "REVIEW_CLOSED";
      applicationDate: string;
      declaredTotal: string;
      currency?: string;
      // 明細列欄位（供列表顯示費用類別 / 消費日期 / 說明）
      category?: string;
      expenseDate?: string;
      vendor?: string;
      description?: string;
    }) {
      const c = await tx.expenseCase.create({
        data: {
          organizationId: org.id,
          caseNumber: opts.caseNumber,
          status: opts.status,
          applicantName: opts.applicantName,
          applicationDate: new Date(opts.applicationDate),
          declaredTotal: new Prisma.Decimal(opts.declaredTotal),
          currency: opts.currency ?? "TWD",
          policyVersionId: policyVersion.id,
        },
      });
      // 建一筆明細列（ExpenseLine），讓列表能顯示類別/日期/說明。
      await tx.expenseLine.create({
        data: {
          caseId: c.id,
          lineNo: 1,
          amount: new Prisma.Decimal(opts.declaredTotal),
          currency: opts.currency ?? "TWD",
          expenseDate: opts.expenseDate
            ? new Date(opts.expenseDate)
            : new Date(opts.applicationDate),
          category: opts.category ?? null,
          vendor: opts.vendor ?? null,
          description: opts.description ?? null,
        },
      });
      const chain = { caseId: c.id, seq: 0, prevHash: null as string | null };
      await appendAudit(tx, chain, "CASE_CREATED", { caseNumber: opts.caseNumber });
      return { c, chain };
    }

    // =====================================================================
    // CASE 1 — NORMAL (all pass, consistent)
    // =====================================================================
    {
      const { c, chain } = await makeCase({
        caseNumber: "EXP-2026-2001",
        applicantName: "王小明",
        status: "DISPOSED",
        applicationDate: "2026-08-12",
        declaredTotal: "1200",
        category: "辦公用品",
        expenseDate: "2026-08-10",
        vendor: "文具行 A",
        description: "辦公用品採購",
      });
      const run = await tx.reviewRun.create({
        data: {
          caseId: c.id,
          roundNo: 1,
          status: "SUCCEEDED",
          policyVersionId: policyVersion.id,
          policyResolution: "EXACT",
          engineVersion: ENGINE_VERSION,
          matchVerdict: "CONSISTENT",
          classification: "NORMAL",
          recommendedAction: "APPROVE",
          confidenceLevel: "HIGH",
        },
      });
      await tx.expenseCase.update({
        where: { id: c.id },
        data: { currentRunId: run.id },
      });
      await tx.ruleResult.create({
        data: {
          runId: run.id,
          checkKey: "R1-lodging",
          ruleDefinitionId: defByCode("R1").id,
          policyRuleId: ruleR1.id,
          ruleCode: "R1",
          outcome: "PASS",
          messageKey: "rule.R1.PASS",
          evaluationBasis: "SINGLE",
        },
      });
      await appendAudit(tx, chain, "RUN_COMPLETED", { classification: "NORMAL" });
    }

    // =====================================================================
    // CASE 2 — EXCEPTION, R7 duplicate (evidence -> refCase)
    // =====================================================================
    {
      const { c, chain } = await makeCase({
        caseNumber: "EXP-2026-2002",
        applicantName: "李美華",
        status: "DISPOSED",
        applicationDate: "2026-08-20",
        declaredTotal: "3500",
        category: "餐費",
        expenseDate: "2026-08-05",
        vendor: "餐廳 B",
        description: "客戶餐敘",
      });
      const run = await tx.reviewRun.create({
        data: {
          caseId: c.id,
          roundNo: 1,
          status: "SUCCEEDED",
          policyVersionId: policyVersion.id,
          policyResolution: "EXACT",
          engineVersion: ENGINE_VERSION,
          classification: "EXCEPTION",
          recommendedAction: "MANUAL_REVIEW",
          triggerStage: "RULES",
          confidenceLevel: "HIGH",
        },
      });
      await tx.expenseCase.update({
        where: { id: c.id },
        data: { currentRunId: run.id },
      });
      const rr = await tx.ruleResult.create({
        data: {
          runId: run.id,
          checkKey: "R7-duplicate",
          ruleDefinitionId: defByCode("R7").id,
          policyRuleId: ruleR7.id,
          ruleCode: "R7",
          outcome: "FAIL",
          severity: "HIGH",
          messageKey: "rule.R7.FAIL",
          evaluationBasis: "SINGLE",
        },
      });
      // Non-pass result MUST carry evidence (governance CHECK). Cross-case rule
      // links the related case so the UI can navigate to the counterpart.
      await tx.evidence.create({
        data: {
          ruleResultId: rr.id,
          policyRuleId: ruleR7.id,
          relatedCaseId: refCase.id,
          snippet: "單號 INV-2026-0805-77、金額 3,500、日期 2026-08-05 三者皆與已結案案件相同。",
        },
      });
      await appendAudit(tx, chain, "RUN_COMPLETED", { classification: "EXCEPTION", rule: "R7" });
    }

    // =====================================================================
    // CASE 3 — MISSING, R4 missing invoice, REQUEST_INFO
    // =====================================================================
    {
      const { c, chain } = await makeCase({
        caseNumber: "EXP-2026-2003",
        applicantName: "黃建宏",
        status: "AWAITING_INFO",
        applicationDate: "2026-08-22",
        declaredTotal: "6200",
        category: "辦公用品",
        expenseDate: "2026-08-22",
        vendor: "3C 賣場",
        description: "辦公設備採購",
      });
      const run = await tx.reviewRun.create({
        data: {
          caseId: c.id,
          roundNo: 1,
          status: "SUCCEEDED",
          policyVersionId: policyVersion.id,
          policyResolution: "EXACT",
          engineVersion: ENGINE_VERSION,
          classification: "MISSING",
          recommendedAction: "REQUEST_INFO",
          triggerStage: "RULES",
          confidenceLevel: "HIGH",
        },
      });
      await tx.expenseCase.update({
        where: { id: c.id },
        data: { currentRunId: run.id },
      });
      const rr = await tx.ruleResult.create({
        data: {
          runId: run.id,
          checkKey: "R4-invoice",
          ruleDefinitionId: defByCode("R4").id,
          policyRuleId: ruleR4.id,
          ruleCode: "R4",
          outcome: "FAIL",
          messageKey: "rule.R4.FAIL",
          evaluationBasis: "SINGLE",
          evaluationDetail: { threshold: 5000, declared: 6200, hasInvoice: false },
        },
      });
      await tx.evidence.create({
        data: {
          ruleResultId: rr.id,
          policyRuleId: ruleR4.id,
          snippet: "金額 6,200 ≥ 5,000 門檻，僅附收據無正式發票。",
        },
      });
      await appendAudit(tx, chain, "RUN_COMPLETED", { classification: "MISSING", rule: "R4" });
    }

    // =====================================================================
    // CASE 4 — HUMAN, foreign invoice, agent abstains (ABSTAIN)
    // =====================================================================
    {
      const { c, chain } = await makeCase({
        caseNumber: "EXP-2026-2004",
        applicantName: "陳大文",
        status: "QUEUED",
        applicationDate: "2026-08-25",
        declaredTotal: "12000",
        currency: "USD",
        category: "差旅費",
        expenseDate: "2026-08-20",
        vendor: "Overseas Hotel",
        description: "國外出差住宿",
      });
      const run = await tx.reviewRun.create({
        data: {
          caseId: c.id,
          roundNo: 1,
          status: "SUCCEEDED",
          policyVersionId: policyVersion.id,
          policyResolution: "EXACT",
          engineVersion: ENGINE_VERSION,
          classification: "HUMAN",
          recommendedAction: "MANUAL_REVIEW",
          triggerStage: "RULES",
          confidenceLevel: "NONE",
          abstainReason: "UNSUPPORTED_CURRENCY",
        },
      });
      await tx.expenseCase.update({
        where: { id: c.id },
        data: { currentRunId: run.id },
      });
      const rr = await tx.ruleResult.create({
        data: {
          runId: run.id,
          checkKey: "GUARD_ELIGIBILITY",
          ruleDefinitionId: defByCode("GUARD_ELIGIBILITY").id,
          ruleCode: "GUARD_ELIGIBILITY",
          outcome: "ABSTAIN",
          messageKey: "rule.guard.eligibility.ABSTAIN",
          evaluationBasis: "SINGLE",
          abstainReason: "UNSUPPORTED_CURRENCY",
        },
      });
      await tx.evidence.create({
        data: {
          ruleResultId: rr.id,
          snippet: "幣別為 USD，非 TWD，本階段不做換算，主動退讓轉人工。",
        },
      });
      await appendAudit(tx, chain, "RUN_COMPLETED", {
        classification: "HUMAN",
        abstain: "UNSUPPORTED_CURRENCY",
      });
    }

    // Reference case gets its own minimal audit trail so seq chains are valid.
    {
      const chain = { caseId: refCase.id, seq: 0, prevHash: null as string | null };
      await appendAudit(tx, chain, "CASE_CREATED", { caseNumber: refCase.caseNumber });
      await appendAudit(tx, chain, "CASE_STATUS_CHANGED", { to: "REVIEW_CLOSED" });
    }

    // reviewer is referenced to keep the variable meaningful for future
    // Disposition seeding; touch it so lint doesn't flag an unused binding.
    void reviewer;
  });

  // Summary
  const counts = await prisma.expenseCase.groupBy({
    by: ["status"],
    _count: true,
  });
  console.log("Seed complete. Cases by status:", counts);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
