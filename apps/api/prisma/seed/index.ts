// =============================================================================
// Demo seed：寫入 CheckMate Prototype 的 8 筆模擬案件與預置審查紀錄。
//
// 流程：先驗證案例自洽（validate.ts），有任何問題就不寫入；再逐案寫入案件、
// 明細、憑證、審查紀錄與 hash-chained 稽核事件。所有案件起始為「待處理」，
// 沒有預置的人工處理紀錄——處理由使用者在工作台操作。
//
// 以 `node --experimental-strip-types` 直接執行，import shared 的 TS 原始碼。
// =============================================================================

import { Prisma, PrismaClient } from "@prisma/client";
import { computeAuditHash } from "../../../../packages/shared/src/hash-chain.ts";
import { CASES } from "./fixtures.ts";
import type { CaseFixture } from "./fixtures.ts";
import { validateFixtures } from "./validate.ts";

const prisma = new PrismaClient();

/** 台北時間，固定時間戳讓 demo 歷程可重現。 */
const taipei = (local: string) => new Date(`${local}:00+08:00`);
const date = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

type Tx = Prisma.TransactionClient;
type Chain = { caseId: string; seq: number; prevHash: string | null };

async function appendAudit(
  tx: Tx,
  chain: Chain,
  type: "CASE_CREATED" | "REVIEW_RECORDED",
  payload: Prisma.InputJsonObject,
  createdAt: Date,
): Promise<void> {
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
      type,
      actorType: "SYSTEM",
      actorLabel: "system:preset-fixture",
      payload,
      prevHash: chain.prevHash,
      hash,
      createdAt,
    },
  });
  chain.seq = seq;
  chain.prevHash = hash;
}

async function seedCase(tx: Tx, c: CaseFixture): Promise<void> {
  const firstReviewAt = taipei(c.reviews[0]!.reviewedAt);
  const created = await tx.expenseCase.create({
    data: {
      caseNumber: c.caseNumber,
      applicantName: c.applicantName,
      employeeId: c.employeeId,
      department: c.department,
      category: c.category,
      amount: new Prisma.Decimal(c.amount),
      expenseDate: date(c.expenseDate),
      submittedAt: date(c.submittedAt),
      summary: c.summary,
      description: c.description,
      paymentMethod: c.paymentMethod,
      scenario: c.scenario,
    },
  });
  const chain: Chain = { caseId: created.id, seq: 0, prevHash: null };
  // 案件建立早於第一次審查
  await appendAudit(
    tx,
    chain,
    "CASE_CREATED",
    { caseNumber: c.caseNumber },
    new Date(firstReviewAt.getTime() - 30 * 60 * 1000),
  );

  const receiptIds = new Map<string, string>();
  for (const r of c.receipts) {
    const receipt = await tx.receipt.create({
      data: {
        caseId: created.id,
        receiptKey: r.key,
        vendor: r.vendor,
        amount: new Prisma.Decimal(r.amount),
        issueDate: date(r.issueDate),
        hasTaxId: r.hasTaxId,
        imagePath: `/fixtures/${r.key}.svg`,
      },
    });
    receiptIds.set(r.key, receipt.id);
  }
  const receiptId = (key: string) => {
    const id = receiptIds.get(key);
    if (!id) throw new Error(`${c.caseNumber}：找不到憑證 ${key}`);
    return id;
  };

  for (const [index, line] of c.lines.entries()) {
    await tx.expenseLine.create({
      data: {
        caseId: created.id,
        lineNo: index + 1,
        lineKey: line.key,
        category: line.category,
        description: line.description,
        expenseDate: date(line.expenseDate),
        amount: new Prisma.Decimal(line.amount),
        receipts: { create: line.receiptKeys.map((key) => ({ receiptId: receiptId(key) })) },
      },
    });
  }

  for (const [index, review] of c.reviews.entries()) {
    const reviewedAt = taipei(review.reviewedAt);
    await tx.reviewRecord.create({
      data: {
        caseId: created.id,
        seq: index + 1,
        reviewKey: review.key,
        reviewedAt,
        recommendation: review.recommendation,
        source: "PRESET",
        checks: { create: review.checks },
        findings: {
          create: review.findings.map((f, order) => ({
            findingKey: f.key,
            orderIndex: order,
            dimension: f.dimension,
            kind: f.kind,
            title: f.title,
            explanation: f.explanation,
            ruleCode: f.ruleCode,
            ruleText: f.ruleText,
            comparison: f.comparison,
            relatedCaseNumber: f.relatedCaseNumber,
            nextStep: f.nextStep,
          })),
        },
        receipts: { create: review.receiptKeys.map((key) => ({ receiptId: receiptId(key) })) },
      },
    });
    await appendAudit(
      tx,
      chain,
      "REVIEW_RECORDED",
      { reviewKey: review.key, recommendation: review.recommendation, source: "PRESET" },
      reviewedAt,
    );
  }
}

async function main(): Promise<void> {
  const problems = validateFixtures(CASES);
  if (problems.length > 0) {
    throw new Error(`Demo 案例不一致，未寫入：\n- ${problems.join("\n- ")}`);
  }

  await prisma.$transaction(async (tx) => {
    for (const c of CASES) await seedCase(tx, c);
  });

  const counts = await prisma.reviewRecord.groupBy({ by: ["recommendation"], _count: true });
  console.log(
    `Seed complete：${CASES.length} 筆案件；最新與歷史審查紀錄依建議分布：`,
    Object.fromEntries(counts.map((c) => [c.recommendation, c._count])),
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
