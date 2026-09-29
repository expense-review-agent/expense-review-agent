import { Injectable, NotFoundException } from "@nestjs/common";
import { agentSummary, diffReviews } from "@expense-review-agent/shared";
import type { CaseDetail, CaseListResponse } from "@expense-review-agent/shared";
import { PrismaService } from "../prisma/prisma.service";
import { isoDate, money, optionalMoney, reviewInclude, toActionRecord, toReview } from "./mappers";

/**
 * CasesService — 工作台的讀取（案件列表、案件詳情）。
 *
 * 審查建議與初審結果一律取自「最新一筆」審查紀錄；歷史紀錄完整回傳，
 * 由前端切換檢視。處理紀錄只看最新審查紀錄（一筆審查紀錄只處理一次）。
 */
@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CaseListResponse> {
    const cases = await this.prisma.expenseCase.findMany({
      orderBy: { caseNumber: "asc" },
      include: {
        reviews: {
          orderBy: { seq: "desc" },
          take: 1,
          include: { findings: { orderBy: { orderIndex: "asc" }, take: 1 } },
        },
      },
    });

    return {
      items: cases.map((c) => {
        const latest = c.reviews[0];
        if (!latest) throw new Error(`案件 ${c.caseNumber} 沒有審查紀錄`);
        return {
          caseNumber: c.caseNumber,
          summary: c.summary,
          applicantName: c.applicantName,
          department: c.department,
          category: c.category,
          amount: money(c.amount),
          currency: c.currency,
          submittedAt: c.submittedAt ? isoDate(c.submittedAt) : null,
          recommendation: latest.recommendation,
          agentSummary: agentSummary(latest.findings),
          status: c.status,
        };
      }),
    };
  }

  async detail(caseNumber: string): Promise<CaseDetail> {
    const c = await this.prisma.expenseCase.findUnique({
      where: { caseNumber },
      include: {
        lines: {
          orderBy: { lineNo: "asc" },
          include: { receipts: { include: { receipt: true } } },
        },
        receipts: { orderBy: { receiptKey: "asc" } },
        reviews: {
          orderBy: { seq: "asc" },
          include: { ...reviewInclude, action: { include: { review: true } } },
        },
      },
    });
    if (!c) throw new NotFoundException(`找不到案件 ${caseNumber}`);

    const reviews = c.reviews.map(toReview);
    const latestAction = c.reviews.at(-1)?.action ?? null;

    return {
      caseNumber: c.caseNumber,
      applicantName: c.applicantName,
      employeeId: c.employeeId,
      department: c.department,
      category: c.category,
      amount: money(c.amount),
      currency: c.currency,
      expenseDate: isoDate(c.expenseDate),
      submittedAt: c.submittedAt ? isoDate(c.submittedAt) : null,
      summary: c.summary,
      description: c.description,
      paymentMethod: c.paymentMethod,
      scenario: c.scenario,
      status: c.status,
      lines: c.lines.map((l) => ({
        key: l.lineKey,
        category: l.category,
        description: l.description,
        expenseDate: isoDate(l.expenseDate),
        amount: money(l.amount),
        netAmount: optionalMoney(l.netAmount),
        taxAmount: optionalMoney(l.taxAmount),
        receiptKeys: l.receipts.map((r) => r.receipt.receiptKey).sort(),
      })),
      receipts: c.receipts.map((r) => ({
        key: r.receiptKey,
        vendor: r.vendor,
        amount: money(r.amount),
        issueDate: isoDate(r.issueDate),
        hasTaxId: r.hasTaxId,
        imagePath: r.imagePath,
      })),
      reviews,
      latestAction: latestAction ? toActionRecord(latestAction) : null,
      reviewDiff: diffReviews(reviews),
    };
  }

  /** 以案件編號取內部 id；找不到回 404。 */
  async idOf(caseNumber: string): Promise<string> {
    const c = await this.prisma.expenseCase.findUnique({
      where: { caseNumber },
      select: { id: true },
    });
    if (!c) throw new NotFoundException(`找不到案件 ${caseNumber}`);
    return c.id;
  }
}
