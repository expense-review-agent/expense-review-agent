// =============================================================================
// Demo seed — skeleton version (tasks §4).
// Covers org / user / policy / rule definitions + policy rules, then 4
// representative cases exercising the full chain under all governance
// constraints:
//   EXP-2026-2001  NORMAL     — all rules pass, consistent
//   EXP-2026-2002  EXCEPTION  — R7 duplicate (paired with a REVIEW_CLOSED case)
//   EXP-2026-2003  MISSING    — R4 missing required invoice, REQUEST_INFO
//   EXP-2026-2004  HUMAN      — foreign invoice, agent abstains (ABSTAIN)
// Plus one paired REVIEW_CLOSED reference case (EXP-2026-1043) for R7, seeded
// with a complete closed history (line, receipt, NORMAL run with passing rule
// results, reviewer disposition, supervisor approval, dated audit trail) so the
// duplicate evidence on EXP-2026-2002 leads somewhere real.
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

/** 台北時間的固定時間戳（demo 歷程要可重現，不能用 new Date()）。 */
const at = (iso: string) => new Date(`${iso}+08:00`);

/** Append an AuditEvent, maintaining the per-case hash chain. */
async function appendAudit(
  tx: Prisma.TransactionClient,
  chain: { caseId: string; seq: number; prevHash: string | null },
  type: string,
  payload: Prisma.InputJsonValue,
  opts: { actorLabel?: string; actorId?: string; runId?: string; createdAt?: Date } = {},
): Promise<void> {
  const actorLabel = opts.actorLabel ?? "system:review-engine";
  // 歷史案件用固定時間戳記（hash 以此計算），新案件用現在時間。
  const createdAt = opts.createdAt ?? new Date();
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
      actorId: opts.actorId ?? null,
      runId: opts.runId ?? null,
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
    const supervisor = await tx.user.create({
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
          code: "R3",
          nameKey: "rule.R3.name",
          layer: "RULE",
          // 門檻比的是金額，申報與單據不一致時兩個基準會得出不同結論 → 需雙假設評估
          dependsOnConsistency: true,
          messageKeyPrefix: "rule.R3",
          paramsSchemaKey: "RequiredAttachmentParams",
        },
        {
          code: "R8",
          nameKey: "rule.R8.name",
          layer: "RULE",
          dependsOnConsistency: false,
          // 拆單只能是「疑似」——產品層 guardrail，組織設定不可覆寫（CLAUDE.md 領域規則 3）
          isSuspicionOnly: true,
          messageKeyPrefix: "rule.R8",
          paramsSchemaKey: "SplitWindowParams",
        },
        {
          code: "R9",
          nameKey: "rule.R9.name",
          layer: "RULE",
          dependsOnConsistency: false,
          messageKeyPrefix: "rule.R9",
          paramsSchemaKey: "BuyerTaxIdParams",
        },
        {
          code: "R10",
          nameKey: "rule.R10.name",
          layer: "MATCH",
          dependsOnConsistency: true,
          messageKeyPrefix: "rule.R10",
        },
        {
          code: "GUARD_ELIGIBILITY",
          nameKey: "rule.guard.eligibility.name",
          // 內建安全邊界沒有條文可引用，所以規範頁面只能靠這段說明解釋它在檢查什麼；
          // 光看名稱「Agent 可判斷範圍」看不出來。
          descKey: "rule.guard.eligibility.desc",
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
            descKey: d.descKey ?? null,
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

    const ruleR3 = await tx.policyRule.create({
      data: {
        policyVersionId: policyVersion.id,
        ruleDefinitionId: defByCode("R3").id,
        ruleKey: "R3-approval",
        clauseRef: "§2.3",
        clauseText: "單筆金額 ≥ NT$50,000 須附簽准書與合約影本",
        params: { threshold: "50000", requires: ["APPROVAL", "CONTRACT"] },
      },
    });
    const ruleR8 = await tx.policyRule.create({
      data: {
        policyVersionId: policyVersion.id,
        ruleDefinitionId: defByCode("R8").id,
        ruleKey: "R8-split",
        clauseRef: "§3.5",
        clauseText: "同申請人、同店家 7 日內多筆申報，加總逾 NT$10,000 視為疑似拆單",
        params: { windowDays: "7", aggregateThreshold: "10000" },
      },
    });
    const ruleR9 = await tx.policyRule.create({
      data: {
        policyVersionId: policyVersion.id,
        ruleDefinitionId: defByCode("R9").id,
        ruleKey: "R9-taxid",
        clauseRef: "§2.4",
        clauseText: "發票買方統一編號須為本公司統編 12345678",
        params: { expectedTaxId: "12345678" },
      },
    });
    const ruleR10 = await tx.policyRule.create({
      data: {
        policyVersionId: policyVersion.id,
        ruleDefinitionId: defByCode("R10").id,
        ruleKey: "R10-sum",
        clauseRef: "§2.5",
        clauseText: "多張憑證的加總須等於申報總額",
        params: { tolerance: "0" },
      },
    });

    // ---- Paired REVIEW_CLOSED reference case for R7 -----------------------
    const refCase = await tx.expenseCase.create({
      data: {
        organizationId: org.id,
        caseNumber: "EXP-2026-1043",
        status: "REVIEW_CLOSED",
        applicantName: "李美華",
        applicantDepartment: "業務部",
        applicationDate: new Date("2026-08-05"),
        declaredTotal: new Prisma.Decimal("3500"),
        policyVersionId: policyVersion.id,
        roundCount: 1,
        submittedAt: new Date("2026-08-05T10:10:00+08:00"),
        closedAt: new Date("2026-08-06T14:05:01+08:00"),
      },
    });

    // Helper to create one case with a run, then return ids for follow-up rows.
    async function makeCase(opts: {
      caseNumber: string;
      applicantName: string;
      /// 申請當時的部門（時點快照）。省略代表來源系統未提供 → 走「未記錄」路徑。
      applicantDepartment?: string;
      status: "DRAFT" | "QUEUED" | "AWAITING_INFO" | "DISPOSED" | "REVIEW_CLOSED";
      applicationDate: string;
      declaredTotal: string;
      currency?: string;
      // 明細列欄位（供列表顯示費用類別 / 消費日期 / 說明）
      category?: string;
      expenseDate?: string;
      vendor?: string;
      description?: string;
      docNo?: string;
    }) {
      const c = await tx.expenseCase.create({
        data: {
          organizationId: org.id,
          caseNumber: opts.caseNumber,
          status: opts.status,
          applicantName: opts.applicantName,
          applicantDepartment: opts.applicantDepartment ?? null,
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
          docNo: opts.docNo ?? null,
        },
      });
      const chain = { caseId: c.id, seq: 0, prevHash: null as string | null };
      await appendAudit(tx, chain, "CASE_CREATED", { caseNumber: opts.caseNumber });
      return { c, chain };
    }

    /**
     * 為案件補上真正的 Reviewer 處置紀錄與對應稽核事件。
     *
     * 流程狀態一旦離開 QUEUED，就必須有一筆說明它的 Disposition——在真實流程裡
     * 只有 Reviewer 送出處置才會推進狀態，所以「已處置但查不到處置人」是不可能出現的
     * 狀態（見 specs/demo-seed）。
     *
     * 徽章與 resultingStatus 都對齊 shared 的 `deriveConsistencyFlag()` /
     * `resolveDisposition()`，但以常數寫入並在呼叫處註明推導依據——seed 以
     * strip-types 直接執行 .ts，無法載入 shared 的 CJS dist（同 hash-chain.ts 的處理）。
     */
    async function seedDisposition(
      chain: { caseId: string; seq: number; prevHash: string | null },
      opts: {
        caseId: string;
        runId: string;
        action: "ACCEPT" | "REQUEST_INFO" | "MANUAL_JUDGEMENT" | "HOLD";
        agentClassificationAtDecision: "NORMAL" | "EXCEPTION" | "MISSING" | "HUMAN";
        agentActionAtDecision: "APPROVE" | "REQUEST_INFO" | "MANUAL_REVIEW";
        finalClassification: "NORMAL" | "EXCEPTION" | "MISSING" | "HUMAN" | null;
        finalAction: "APPROVE" | "REQUEST_INFO" | "MANUAL_REVIEW" | null;
        consistencyFlag:
          "CONSISTENT" | "OVERRIDDEN" | "HUMAN_ASSUMED" | "ESCALATED" | "PENDING_DECISION";
        reason?: string;
        resultingStatus: "QUEUED" | "AWAITING_INFO" | "DISPOSED";
        escalated: boolean;
        at: Date;
      },
    ): Promise<void> {
      const disposition = await tx.disposition.create({
        data: {
          caseId: opts.caseId,
          runId: opts.runId,
          actorId: reviewer.id,
          action: opts.action,
          agentClassificationAtDecision: opts.agentClassificationAtDecision,
          agentActionAtDecision: opts.agentActionAtDecision,
          finalClassification: opts.finalClassification,
          finalAction: opts.finalAction,
          consistencyFlag: opts.consistencyFlag,
          reason: opts.reason ?? null,
          resultingStatus: opts.resultingStatus,
          createdAt: opts.at,
        },
      });
      await appendAudit(
        tx,
        chain,
        "REVIEWER_DISPOSITION",
        {
          dispositionId: disposition.id,
          action: opts.action,
          finalAction: opts.finalAction,
          consistencyFlag: opts.consistencyFlag,
          escalated: opts.escalated,
        },
        {
          actorLabel: "system:review-api",
          actorId: reviewer.id,
          runId: opts.runId,
          createdAt: opts.at,
        },
      );
    }

    // =====================================================================
    // CASE 1 — NORMAL (all pass, consistent)
    // =====================================================================
    {
      const { c, chain } = await makeCase({
        caseNumber: "EXP-2026-2001",
        applicantName: "王小明",
        applicantDepartment: "業務部",
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

      // Reviewer 採用建議：agent = APPROVE、final = APPROVE
      // → deriveConsistencyFlag：agent ≠ MANUAL_REVIEW 且 final = agent → CONSISTENT
      // → resolveDisposition(APPROVE, ACCEPT).resultingStatus → DISPOSED
      await seedDisposition(chain, {
        caseId: c.id,
        runId: run.id,
        action: "ACCEPT",
        agentClassificationAtDecision: "NORMAL",
        agentActionAtDecision: "APPROVE",
        finalClassification: "NORMAL",
        finalAction: "APPROVE",
        consistencyFlag: "CONSISTENT",
        resultingStatus: "DISPOSED",
        escalated: false,
        at: at("2026-08-13T09:20:00"),
      });
    }

    // =====================================================================
    // CASE 2 — EXCEPTION, R7 duplicate (evidence -> refCase)
    // =====================================================================
    {
      const { c, chain } = await makeCase({
        caseNumber: "EXP-2026-2002",
        applicantName: "李美華",
        applicantDepartment: "業務部",
        status: "DISPOSED",
        applicationDate: "2026-08-20",
        declaredTotal: "3500",
        category: "餐費",
        expenseDate: "2026-08-05",
        vendor: "餐廳 B",
        description: "客戶餐敘",
        docNo: "INV-2026-0805-77", // 與參照案件 EXP-2026-1043 相同（R7 疑似重複的依據）
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

      // Reviewer 採用 MANUAL_REVIEW 建議 = 轉呈主管，人與 Agent 都沒下最終結論。
      // ACCEPT 的 finalAction 由動作本身決定（= 當時的建議），與 API 的
      // resolveFinalAction 一致：final = MANUAL_REVIEW
      // → deriveConsistencyFlag：agent = final = MANUAL_REVIEW → ESCALATED
      // → finalClassification：final === 建議 → 沿用當時的 Agent 分類（EXCEPTION）
      // → resolveDisposition(MANUAL_REVIEW, ACCEPT)：resultingStatus DISPOSED、escalates
      //
      // 註：PENDING_DECISION 只在 finalAction 為 null 時產生，而那只發生在 HOLD，
      // HOLD 的 resultingStatus 是 QUEUED——「PENDING_DECISION + DISPOSED」是真實流程
      // 產不出來的組合，不可寫進 seed。
      await seedDisposition(chain, {
        caseId: c.id,
        runId: run.id,
        action: "ACCEPT",
        agentClassificationAtDecision: "EXCEPTION",
        agentActionAtDecision: "MANUAL_REVIEW",
        finalClassification: "EXCEPTION",
        finalAction: "MANUAL_REVIEW",
        consistencyFlag: "ESCALATED",
        resultingStatus: "DISPOSED",
        escalated: true,
        at: at("2026-08-21T14:05:00"),
      });
    }

    // =====================================================================
    // CASE 3 — MISSING, large amount missing BOTH invoice (R4) and
    //          approval/contract (R3) — 一次列全缺口，不是逐條退件
    // ---------------------------------------------------------------------
    // =====================================================================
    {
      const { c, chain } = await makeCase({
        caseNumber: "EXP-2026-2003",
        applicantName: "黃建宏",
        applicantDepartment: "研發部",
        status: "AWAITING_INFO",
        applicationDate: "2026-08-22",
        declaredTotal: "62000",
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
          evaluationDetail: { threshold: 5000, declared: 62000, hasInvoice: false },
        },
      });
      await tx.evidence.create({
        data: {
          ruleResultId: rr.id,
          policyRuleId: ruleR4.id,
          snippet: "金額 62,000 ≥ 5,000 門檻，僅附收據無正式發票。",
        },
      });
      // R3 依賴一致性，但本案缺單據 → 沒有單據基準可比，只能以申報值評估
      // （DECLARED_ONLY）。缺口要一次列全，不能只報 R4 讓申請人來回補兩趟。
      const rr3 = await tx.ruleResult.create({
        data: {
          runId: run.id,
          checkKey: "R3-approval",
          ruleDefinitionId: defByCode("R3").id,
          policyRuleId: ruleR3.id,
          ruleCode: "R3",
          outcome: "FAIL",
          severity: "MEDIUM",
          messageKey: "rule.R3.FAIL",
          evaluationBasis: "DECLARED_ONLY",
          evaluationDetail: {
            threshold: 50000,
            declared: 62000,
            hasApproval: false,
            hasContract: false,
          },
        },
      });
      await tx.evidence.create({
        data: {
          ruleResultId: rr3.id,
          policyRuleId: ruleR3.id,
          snippet: "金額 62,000 ≥ 50,000 門檻，未附簽准書與合約影本。",
        },
      });
      await appendAudit(tx, chain, "RUN_COMPLETED", {
        classification: "MISSING",
        rules: ["R4", "R3"],
      });
    }

    // =====================================================================
    // CASE 4 — HUMAN, foreign invoice, agent abstains (ABSTAIN)
    // =====================================================================
    {
      const { c, chain } = await makeCase({
        caseNumber: "EXP-2026-2004",
        applicantName: "陳大文",
        // 刻意不給部門：走「未記錄」路徑（部門欄不可點選）

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

    // =====================================================================
    // CASE 5 — EXCEPTION, R1 lodging over-limit
    // 條文與差額都要能指回證據，主管才看得出「超多少、憑哪一條」。
    // =====================================================================
    {
      const { c, chain } = await makeCase({
        caseNumber: "EXP-2026-2005",
        applicantName: "林志豪",
        applicantDepartment: "業務部",
        status: "QUEUED",
        applicationDate: "2026-08-26",
        declaredTotal: "6000",
        category: "住宿",
        expenseDate: "2026-08-24",
        vendor: "城市商旅",
        description: "出差住宿一晚",
        docNo: "INV-2026-0824-11",
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
          classification: "EXCEPTION",
          recommendedAction: "MANUAL_REVIEW",
          triggerStage: "RULES",
          confidenceLevel: "HIGH",
        },
      });
      await tx.expenseCase.update({ where: { id: c.id }, data: { currentRunId: run.id } });
      const rr = await tx.ruleResult.create({
        data: {
          runId: run.id,
          checkKey: "R1-lodging",
          ruleDefinitionId: defByCode("R1").id,
          policyRuleId: ruleR1.id,
          ruleCode: "R1",
          outcome: "FAIL",
          severity: "MEDIUM",
          messageKey: "rule.R1.FAIL",
          // 申報與單據一致，兩個基準會得到同一結論 → BOTH_AGREE（非 SINGLE）
          evaluationBasis: "BOTH_AGREE",
          evaluationDetail: { limit: 4000, actual: 6000, excess: 2000, nights: 1 },
        },
      });
      await tx.evidence.create({
        data: {
          ruleResultId: rr.id,
          policyRuleId: ruleR1.id,
          snippet: "住宿一晚 6,000，逾 §4.2 每晚上限 4,000，超出 2,000。",
        },
      });
      await appendAudit(tx, chain, "RUN_COMPLETED", { classification: "EXCEPTION", rule: "R1" });
    }

    // =====================================================================
    // CASE 6 — EXCEPTION, R5 mismatch driving a DIVERGENT dual-basis gate
    //
    // 這是整份 seed 最重要的一筆：申報 4,200 / 單據 3,900 不一致，而 R1 的門檻
    // 恰好落在兩者之間（4,000）——以申報值評估會 FAIL，以單據值評估會 PASS。
    // 結論分歧時**不得靜默跳過 R1**（那是漏判），必須輸出 GATED 並附 gateReasonKey。
    // =====================================================================
    {
      const { c, chain } = await makeCase({
        caseNumber: "EXP-2026-2006",
        applicantName: "吳雅婷",
        applicantDepartment: "行銷部",
        status: "QUEUED",
        applicationDate: "2026-08-27",
        declaredTotal: "4200",
        category: "住宿",
        expenseDate: "2026-08-25",
        vendor: "海濱旅店",
        description: "客戶拜訪住宿",
        docNo: "INV-2026-0825-42",
      });
      const line = await tx.expenseLine.findFirstOrThrow({ where: { caseId: c.id, lineNo: 1 } });
      const receipt = await tx.receipt.create({
        data: {
          caseId: c.id,
          extractionSource: "STRUCTURED_FIXTURE",
          docNo: "INV-2026-0825-42",
          issueDate: new Date("2026-08-25"),
          amount: new Prisma.Decimal("3900"),
          currency: "TWD",
          vendor: "海濱旅店",
          category: "住宿",
          minConfidenceLevel: "HIGH",
        },
      });
      const run = await tx.reviewRun.create({
        data: {
          caseId: c.id,
          roundNo: 1,
          status: "SUCCEEDED",
          policyVersionId: policyVersion.id,
          policyResolution: "EXACT",
          engineVersion: ENGINE_VERSION,
          matchVerdict: "INCONSISTENT",
          declaredCount: 1,
          receiptCount: 1,
          classification: "EXCEPTION",
          recommendedAction: "MANUAL_REVIEW",
          triggerStage: "MATCHING",
          confidenceLevel: "HIGH",
          inputSnapshot: {
            caseNumber: "EXP-2026-2006",
            declaredTotal: "4200",
            currency: "TWD",
            lines: [{ lineNo: 1, docNo: "INV-2026-0825-42", amount: "4200" }],
            receipts: [{ docNo: "INV-2026-0825-42", amount: "3900" }],
          },
        },
      });
      await tx.expenseCase.update({ where: { id: c.id }, data: { currentRunId: run.id } });
      await tx.receiptLineLink.create({
        data: {
          runId: run.id,
          lineId: line.id,
          receiptId: receipt.id,
          matchScore: new Prisma.Decimal("0.9"),
          matchedBy: "docNo",
        },
      });

      // 比對層：逐欄金額不一致
      const mr = await tx.matchResult.create({
        data: {
          runId: run.id,
          scope: "LINE_FIELD",
          outcome: "MISMATCHED",
          lineId: line.id,
          receiptId: receipt.id,
          fieldKey: "amount",
          declaredValue: "4200",
          receiptValue: "3900",
          diffAmount: new Prisma.Decimal("300"),
          messageKey: "rule.R5.FAIL",
        },
      });
      await tx.evidence.create({
        data: {
          matchResultId: mr.id,
          snippet: "申報 4,200 與單據 3,900 不一致，差額 300。",
        },
      });
      const rr5 = await tx.ruleResult.create({
        data: {
          runId: run.id,
          checkKey: "R5-amount",
          ruleDefinitionId: defByCode("R5").id,
          ruleCode: "R5",
          outcome: "FAIL",
          severity: "MEDIUM",
          messageKey: "rule.R5.FAIL",
          evaluationBasis: "SINGLE",
          evaluationDetail: { declared: "4200", receipt: "3900", diff: "300" },
        },
      });
      await tx.evidence.create({
        data: {
          ruleResultId: rr5.id,
          snippet: "申報金額 4,200；單據金額 3,900。",
        },
      });

      // 規則層：R1 依賴一致性，兩個基準結論分歧 → GATED（絕不可靜默跳過）
      const rr1 = await tx.ruleResult.create({
        data: {
          runId: run.id,
          checkKey: "R1-lodging",
          ruleDefinitionId: defByCode("R1").id,
          policyRuleId: ruleR1.id,
          ruleCode: "R1",
          outcome: "GATED",
          severity: "MEDIUM",
          messageKey: "rule.R1.GATED",
          evaluationBasis: "DIVERGENT",
          // 治理 CHECK：outcome = GATED 必附 gateReasonKey
          gateReasonKey: "gate.amountMismatch",
          gatedByMatchId: mr.id,
          evaluationDetail: {
            limit: 4000,
            declaredBasis: { actual: 4200, outcome: "FAIL" },
            receiptBasis: { actual: 3900, outcome: "PASS" },
          },
        },
      });
      await tx.evidence.create({
        data: {
          ruleResultId: rr1.id,
          policyRuleId: ruleR1.id,
          snippet:
            "以申報值 4,200 評估逾 §4.2 上限 4,000；以單據值 3,900 評估則未逾。兩者分歧，暫不判定。",
        },
      });
      await appendAudit(tx, chain, "RUN_COMPLETED", {
        classification: "EXCEPTION",
        rules: ["R5", "R1(GATED)"],
      });
    }

    // =====================================================================
    // CASE 7 + 8 — EXCEPTION, R8 suspected split (cross-case pair)
    //
    // 跨案件規則單獨一筆永遠不會觸發，所以這兩筆必須成對存在：同申請人、同店家、
    // 7 日內，各自低於 §3.5 的 10,000 門檻，加總 11,500 才超過。
    // R8 的 isSuspicionOnly = true → 措辭只能是「疑似」，不得表述為認定拆單。
    // =====================================================================
    {
      const pair = [
        {
          caseNumber: "EXP-2026-2007",
          date: "2026-08-10",
          amount: "6000",
          docNo: "INV-2026-0810-31",
        },
        {
          caseNumber: "EXP-2026-2008",
          date: "2026-08-14",
          amount: "5500",
          docNo: "INV-2026-0814-08",
        },
      ];
      const built: Array<{ id: string; caseNumber: string; ruleResultId: string }> = [];

      for (const item of pair) {
        const { c, chain } = await makeCase({
          caseNumber: item.caseNumber,
          applicantName: "王俊傑",
          applicantDepartment: "資訊部",
          status: "QUEUED",
          applicationDate: item.date,
          declaredTotal: item.amount,
          category: "辦公用品",
          expenseDate: item.date,
          vendor: "文具行 A",
          description: "部門文具補充",
          docNo: item.docNo,
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
            classification: "EXCEPTION",
            recommendedAction: "MANUAL_REVIEW",
            triggerStage: "RULES",
            confidenceLevel: "HIGH",
          },
        });
        await tx.expenseCase.update({ where: { id: c.id }, data: { currentRunId: run.id } });
        const rr = await tx.ruleResult.create({
          data: {
            runId: run.id,
            checkKey: "R8-split",
            ruleDefinitionId: defByCode("R8").id,
            policyRuleId: ruleR8.id,
            ruleCode: "R8",
            outcome: "FAIL",
            severity: "MEDIUM",
            messageKey: "rule.R8.FAIL",
            evaluationBasis: "SINGLE",
            evaluationDetail: {
              windowDays: 7,
              aggregateThreshold: 10000,
              aggregate: 11500,
              entries: pair.map((x) => ({ caseNumber: x.caseNumber, amount: x.amount })),
            },
          },
        });
        await appendAudit(tx, chain, "RUN_COMPLETED", { classification: "EXCEPTION", rule: "R8" });
        built.push({ id: c.id, caseNumber: item.caseNumber, ruleResultId: rr.id });
      }

      // 證據互指對方：兩筆都建好後才掛，否則第二筆還不存在。
      for (const [i, entry] of built.entries()) {
        const other = built[(i + 1) % built.length];
        await tx.evidence.create({
          data: {
            ruleResultId: entry.ruleResultId,
            policyRuleId: ruleR8.id,
            relatedCaseId: other.id,
            snippet:
              `與 ${other.caseNumber}（同申請人、同店家「文具行 A」，相隔 4 日）加總 11,500，` +
              "逾 §3.5 的 10,000 門檻，疑似拆單，需人工確認。",
          },
        });
      }
    }

    // =====================================================================
    // CASE 9 — EXCEPTION, R10 multi-receipt sum difference (Tier 1 亮點)
    // 三張憑證加總 9,400，申報總額 10,000，差 600 —— 逐張看都正常，只有加總才看得出來。
    // =====================================================================
    {
      const { c, chain } = await makeCase({
        caseNumber: "EXP-2026-2009",
        applicantName: "張淑芬",
        applicantDepartment: "行政部",
        status: "QUEUED",
        applicationDate: "2026-08-28",
        declaredTotal: "10000",
        category: "會議餐費",
        expenseDate: "2026-08-26",
        vendor: "外燴服務",
        description: "季度會議餐飲（三張憑證）",
      });
      const line = await tx.expenseLine.findFirstOrThrow({ where: { caseId: c.id, lineNo: 1 } });

      const receiptSpecs = [
        { docNo: "INV-2026-0826-01", amount: "3000" },
        { docNo: "INV-2026-0826-02", amount: "3200" },
        { docNo: "INV-2026-0826-03", amount: "3200" },
      ];
      const receipts = [];
      for (const r of receiptSpecs) {
        receipts.push(
          await tx.receipt.create({
            data: {
              caseId: c.id,
              extractionSource: "STRUCTURED_FIXTURE",
              docNo: r.docNo,
              issueDate: new Date("2026-08-26"),
              amount: new Prisma.Decimal(r.amount),
              currency: "TWD",
              vendor: "外燴服務",
              category: "會議餐費",
              minConfidenceLevel: "HIGH",
            },
          }),
        );
      }

      const run = await tx.reviewRun.create({
        data: {
          caseId: c.id,
          roundNo: 1,
          status: "SUCCEEDED",
          policyVersionId: policyVersion.id,
          policyResolution: "EXACT",
          engineVersion: ENGINE_VERSION,
          matchVerdict: "INCONSISTENT",
          declaredCount: 1,
          receiptCount: 3,
          sumDifference: new Prisma.Decimal("600"),
          classification: "EXCEPTION",
          recommendedAction: "MANUAL_REVIEW",
          triggerStage: "MATCHING",
          confidenceLevel: "HIGH",
          inputSnapshot: {
            caseNumber: "EXP-2026-2009",
            declaredTotal: "10000",
            currency: "TWD",
            receipts: receiptSpecs,
          },
        },
      });
      await tx.expenseCase.update({ where: { id: c.id }, data: { currentRunId: run.id } });
      for (const r of receipts) {
        await tx.receiptLineLink.create({
          data: {
            runId: run.id,
            lineId: line.id,
            receiptId: r.id,
            matchScore: new Prisma.Decimal("0.8"),
            matchedBy: "amountSum",
          },
        });
      }

      const mr = await tx.matchResult.create({
        data: {
          runId: run.id,
          scope: "TOTAL_SUM",
          outcome: "MISMATCHED",
          fieldKey: "amount",
          declaredValue: "10000",
          receiptValue: "9400",
          diffAmount: new Prisma.Decimal("600"),
          messageKey: "rule.R10.FAIL",
        },
      });
      await tx.evidence.create({
        data: {
          matchResultId: mr.id,
          snippet: "三張憑證 3,000 + 3,200 + 3,200 = 9,400，與申報總額 10,000 差 600。",
        },
      });
      const rr = await tx.ruleResult.create({
        data: {
          runId: run.id,
          checkKey: "R10-sum",
          ruleDefinitionId: defByCode("R10").id,
          policyRuleId: ruleR10.id,
          ruleCode: "R10",
          outcome: "FAIL",
          severity: "MEDIUM",
          messageKey: "rule.R10.FAIL",
          evaluationBasis: "SINGLE",
          evaluationDetail: { declaredTotal: "10000", receiptSum: "9400", difference: "600" },
        },
      });
      await tx.evidence.create({
        data: {
          ruleResultId: rr.id,
          policyRuleId: ruleR10.id,
          snippet: "憑證加總 9,400 ≠ 申報總額 10,000，差額 600。",
        },
      });
      await appendAudit(tx, chain, "RUN_COMPLETED", { classification: "EXCEPTION", rule: "R10" });
    }

    // =====================================================================
    // CASE 10 — MISSING, R9 buyer tax id mismatch → 請申請人換開發票
    // 這是「缺件」而非「例外」：發票本身有效，只是抬頭開錯，補正即可。
    // =====================================================================
    {
      const { c, chain } = await makeCase({
        caseNumber: "EXP-2026-2010",
        applicantName: "鄭偉成",
        applicantDepartment: "研發部",
        status: "QUEUED",
        applicationDate: "2026-08-29",
        declaredTotal: "8800",
        category: "軟體訂閱",
        expenseDate: "2026-08-27",
        vendor: "雲端服務商",
        description: "開發工具年費",
        docNo: "INV-2026-0827-55",
      });
      const receipt = await tx.receipt.create({
        data: {
          caseId: c.id,
          extractionSource: "STRUCTURED_FIXTURE",
          docNo: "INV-2026-0827-55",
          issueDate: new Date("2026-08-27"),
          amount: new Prisma.Decimal("8800"),
          currency: "TWD",
          vendor: "雲端服務商",
          category: "軟體訂閱",
          buyerTaxId: "87654321",
          minConfidenceLevel: "HIGH",
        },
      });
      await tx.extractedField.create({
        data: {
          receiptId: receipt.id,
          fieldKey: "buyerTaxId",
          rawText: "87654321",
          normalizedValue: "87654321",
          isRecognized: true,
          confidenceLevel: "HIGH",
          confidenceScore: new Prisma.Decimal("0.9800"),
        },
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
          declaredCount: 1,
          receiptCount: 1,
          classification: "MISSING",
          recommendedAction: "REQUEST_INFO",
          triggerStage: "RULES",
          confidenceLevel: "HIGH",
        },
      });
      await tx.expenseCase.update({ where: { id: c.id }, data: { currentRunId: run.id } });
      const rr = await tx.ruleResult.create({
        data: {
          runId: run.id,
          checkKey: "R9-taxid",
          ruleDefinitionId: defByCode("R9").id,
          policyRuleId: ruleR9.id,
          ruleCode: "R9",
          outcome: "FAIL",
          severity: "LOW",
          messageKey: "rule.R9.FAIL",
          evaluationBasis: "SINGLE",
          evaluationDetail: { expected: "12345678", actual: "87654321" },
        },
      });
      await tx.evidence.create({
        data: {
          ruleResultId: rr.id,
          policyRuleId: ruleR9.id,
          snippet: "發票買方統編 87654321，與 §2.4 規定的本公司統編 12345678 不符。",
        },
      });
      await appendAudit(tx, chain, "RUN_COMPLETED", { classification: "MISSING", rule: "R9" });
    }

    // =====================================================================
    // CASE 11 — HUMAN, unmatched receipt + low-confidence key field
    //
    // 兩件事在同一筆案件上演示（tasks 4.2 未匹配單據 / 4.4 低信心欄位）：
    //   1. 合併檔裡有一張單據對不上任何申報項目 → UNMATCHED_RECEIPT
    //   2. 該張單據的關鍵欄位 docNo 根本沒認出來（isRecognized = false、NONE）
    // 關鍵欄位信心不足時**不得硬判 NORMAL**（CLAUDE.md 領域規則 4），
    // Agent 主動退讓 ABSTAIN(LOW_CONFIDENCE) → HUMAN。
    // =====================================================================
    {
      const { c, chain } = await makeCase({
        caseNumber: "EXP-2026-2011",
        applicantName: "許雅琳",
        applicantDepartment: "行政部",
        status: "QUEUED",
        applicationDate: "2026-08-30",
        declaredTotal: "2400",
        category: "交通費",
        expenseDate: "2026-08-28",
        vendor: "計程車行",
        description: "客戶拜訪交通（掃描檔含多張單據）",
        docNo: "INV-2026-0828-19",
      });
      const line = await tx.expenseLine.findFirstOrThrow({ where: { caseId: c.id, lineNo: 1 } });

      // 對得上的那張
      const matchedReceipt = await tx.receipt.create({
        data: {
          caseId: c.id,
          extractionSource: "STRUCTURED_FIXTURE",
          docNo: "INV-2026-0828-19",
          issueDate: new Date("2026-08-28"),
          amount: new Prisma.Decimal("2400"),
          currency: "TWD",
          vendor: "計程車行",
          category: "交通費",
          minConfidenceLevel: "HIGH",
        },
      });
      // 對不上的那張：單號沒認出來，金額也不屬於任何申報項目
      const strayReceipt = await tx.receipt.create({
        data: {
          caseId: c.id,
          extractionSource: "STRUCTURED_FIXTURE",
          docNo: null,
          issueDate: new Date("2026-08-28"),
          amount: new Prisma.Decimal("1350"),
          currency: "TWD",
          vendor: "未能辨識",
          minConfidenceLevel: "NONE",
        },
      });
      await tx.extractedField.create({
        data: {
          receiptId: strayReceipt.id,
          fieldKey: "docNo",
          rawText: "IN\u00a0V-2026-08\u25a1\u25a1-\u25a1\u25a1",
          normalizedValue: null,
          isRecognized: false,
          confidenceLevel: "NONE",
          confidenceScore: new Prisma.Decimal("0.1200"),
        },
      });
      await tx.extractedField.create({
        data: {
          receiptId: strayReceipt.id,
          fieldKey: "vendor",
          rawText: "\u25a1\u25a1\u8eca\u884c",
          normalizedValue: null,
          isRecognized: false,
          confidenceLevel: "LOW",
          confidenceScore: new Prisma.Decimal("0.3100"),
        },
      });

      const run = await tx.reviewRun.create({
        data: {
          caseId: c.id,
          roundNo: 1,
          status: "SUCCEEDED",
          policyVersionId: policyVersion.id,
          policyResolution: "EXACT",
          engineVersion: ENGINE_VERSION,
          matchVerdict: "PARTIAL",
          declaredCount: 1,
          receiptCount: 2,
          classification: "HUMAN",
          recommendedAction: "MANUAL_REVIEW",
          triggerStage: "EXTRACTION",
          confidenceLevel: "LOW",
          abstainReason: "LOW_CONFIDENCE",
          inputSnapshot: {
            caseNumber: "EXP-2026-2011",
            declaredTotal: "2400",
            currency: "TWD",
            receipts: [
              { docNo: "INV-2026-0828-19", amount: "2400" },
              { docNo: null, amount: "1350", recognized: false },
            ],
          },
        },
      });
      await tx.expenseCase.update({ where: { id: c.id }, data: { currentRunId: run.id } });
      await tx.receiptLineLink.create({
        data: {
          runId: run.id,
          lineId: line.id,
          receiptId: matchedReceipt.id,
          matchScore: new Prisma.Decimal("1"),
          matchedBy: "docNo",
        },
      });

      const mr = await tx.matchResult.create({
        data: {
          runId: run.id,
          scope: "UNMATCHED_RECEIPT",
          outcome: "UNMATCHED",
          receiptId: strayReceipt.id,
          declaredValue: null,
          receiptValue: "1350",
          messageKey: "match.unmatchedReceipt",
        },
      });
      await tx.evidence.create({
        data: {
          matchResultId: mr.id,
          snippet: "掃描檔第 2 頁有一張 1,350 的單據，對不上任何申報項目，單號未能辨識。",
        },
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
          // 治理 CHECK：outcome = ABSTAIN 必附 abstainReason
          abstainReason: "LOW_CONFIDENCE",
        },
      });
      await tx.evidence.create({
        data: {
          ruleResultId: rr.id,
          snippet: "關鍵欄位「單號」未能辨識（信心 NONE），資料不足以判定，轉人工。",
        },
      });
      await appendAudit(tx, chain, "RUN_COMPLETED", {
        classification: "HUMAN",
        abstain: "LOW_CONFIDENCE",
      });
    }

    // =====================================================================
    // REFERENCE CASE — EXP-2026-1043, complete closed history (paired with R7)
    // 2002 的疑似重複證據指向這筆：單號、金額、日期三者相同。歷程依時間順序：
    //   08-05 建立 → Agent 初審 NORMAL（全數通過）→ 08-06 初審採用建議 → 主管核可結案
    // =====================================================================
    {
      const chain = { caseId: refCase.id, seq: 0, prevHash: null as string | null };

      const line = await tx.expenseLine.create({
        data: {
          caseId: refCase.id,
          lineNo: 1,
          docNo: "INV-2026-0805-77",
          expenseDate: new Date("2026-08-05"),
          amount: new Prisma.Decimal("3500"),
          currency: "TWD",
          vendor: "餐廳 B",
          category: "餐費",
          description: "客戶餐敘",
        },
      });
      const receipt = await tx.receipt.create({
        data: {
          caseId: refCase.id,
          extractionSource: "STRUCTURED_FIXTURE",
          docNo: "INV-2026-0805-77",
          issueDate: new Date("2026-08-05"),
          amount: new Prisma.Decimal("3500"),
          currency: "TWD",
          vendor: "餐廳 B",
          category: "餐費",
          minConfidenceLevel: "HIGH",
        },
      });

      await appendAudit(
        tx,
        chain,
        "CASE_CREATED",
        { caseNumber: refCase.caseNumber },
        { createdAt: at("2026-08-05T10:12:00") },
      );

      const run = await tx.reviewRun.create({
        data: {
          caseId: refCase.id,
          roundNo: 1,
          status: "SUCCEEDED",
          policyVersionId: policyVersion.id,
          policyResolution: "EXACT",
          engineVersion: ENGINE_VERSION,
          matchVerdict: "CONSISTENT",
          declaredCount: 1,
          receiptCount: 1,
          sumDifference: new Prisma.Decimal("0"),
          classification: "NORMAL",
          recommendedAction: "APPROVE",
          confidenceLevel: "HIGH",
          inputSnapshot: {
            caseNumber: refCase.caseNumber,
            declaredTotal: "3500",
            currency: "TWD",
            lines: [{ lineNo: 1, docNo: "INV-2026-0805-77", amount: "3500", date: "2026-08-05" }],
            receipts: [{ docNo: "INV-2026-0805-77", amount: "3500", date: "2026-08-05" }],
          },
          startedAt: at("2026-08-05T10:13:00"),
          finishedAt: at("2026-08-05T10:13:04"),
          createdAt: at("2026-08-05T10:13:00"),
        },
      });
      await tx.expenseCase.update({
        where: { id: refCase.id },
        data: { currentRunId: run.id },
      });
      await tx.receiptLineLink.create({
        data: {
          runId: run.id,
          lineId: line.id,
          receiptId: receipt.id,
          matchScore: new Prisma.Decimal("1"),
          matchedBy: "docNo",
        },
      });

      // 全數 PASS——PASS 不需證據（治理 CHECK 只要求非通過結果附證據）。
      // R7 當時沒有更早的同單號案件，所以通過；之後 2002 才因與本案相同而觸發。
      for (const r of [
        {
          checkKey: "R4-invoice",
          code: "R4",
          policyRuleId: ruleR4.id,
          detail: { threshold: 5000, declared: 3500, hasInvoice: true },
        },
        {
          checkKey: "R5-amount",
          code: "R5",
          policyRuleId: null,
          detail: { declared: "3500", receipt: "3500" },
        },
        { checkKey: "R7-duplicate", code: "R7", policyRuleId: ruleR7.id, detail: { matches: 0 } },
      ]) {
        await tx.ruleResult.create({
          data: {
            runId: run.id,
            checkKey: r.checkKey,
            ruleDefinitionId: defByCode(r.code).id,
            policyRuleId: r.policyRuleId,
            ruleCode: r.code,
            outcome: "PASS",
            messageKey: `rule.${r.code}.PASS`,
            evaluationBasis: "SINGLE",
            evaluationDetail: r.detail,
          },
        });
      }
      await appendAudit(
        tx,
        chain,
        "RUN_COMPLETED",
        { runId: run.id, classification: "NORMAL" },
        { runId: run.id, createdAt: at("2026-08-05T10:13:04") },
      );

      // Reviewer 採用建議：agentActionAtDecision = APPROVE、finalAction = APPROVE。
      // 徽章依 shared deriveConsistencyFlag()（agent ≠ MANUAL_REVIEW 且 final = agent）→ CONSISTENT。
      // seed 以 strip-types 直接執行、無法載入 shared 的 CJS dist，故以常數寫入。
      const disposition = await tx.disposition.create({
        data: {
          caseId: refCase.id,
          runId: run.id,
          actorId: reviewer.id,
          action: "ACCEPT",
          agentClassificationAtDecision: "NORMAL",
          agentActionAtDecision: "APPROVE",
          finalClassification: "NORMAL",
          finalAction: "APPROVE",
          consistencyFlag: "CONSISTENT",
          reason: null,
          resultingStatus: "DISPOSED",
          createdAt: at("2026-08-06T09:40:00"),
        },
      });
      await appendAudit(
        tx,
        chain,
        "REVIEWER_DISPOSITION",
        {
          dispositionId: disposition.id,
          action: "ACCEPT",
          finalAction: "APPROVE",
          consistencyFlag: "CONSISTENT",
          escalated: false,
        },
        {
          actorLabel: "system:review-api",
          actorId: reviewer.id,
          runId: run.id,
          createdAt: at("2026-08-06T09:40:00"),
        },
      );

      const review = await tx.supervisorReview.create({
        data: {
          caseId: refCase.id,
          actorId: supervisor.id,
          action: "APPROVE",
          comment: "與初審結論一致，核可結案。",
          resultingStatus: "REVIEW_CLOSED",
          createdAt: at("2026-08-06T14:05:00"),
        },
      });
      await appendAudit(
        tx,
        chain,
        "SUPERVISOR_REVIEW",
        { supervisorReviewId: review.id, action: "APPROVE" },
        {
          actorLabel: "system:review-api",
          actorId: supervisor.id,
          createdAt: at("2026-08-06T14:05:00"),
        },
      );
      await appendAudit(
        tx,
        chain,
        "CASE_STATUS_CHANGED",
        { to: "REVIEW_CLOSED" },
        { createdAt: at("2026-08-06T14:05:01") },
      );
    }
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
