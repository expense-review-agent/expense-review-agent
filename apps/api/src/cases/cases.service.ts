import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CaseSummary,
  CaseListItem,
  CaseDetail,
  CaseCheck,
  RelatedCasesResponse,
} from "@expense-review-agent/shared";

/**
 * CasesService — 案件相關的業務邏輯（對應 API #2~#6）。
 *
 * 學習重點：
 * - @Injectable() + constructor 注入 PrismaService，就能用 this.prisma 查 DB。
 * - 每個 public 方法對應一支 API 的邏輯；Controller 只負責把請求轉進來。
 * - Prisma 的 Decimal / Date 要轉成前端好用的字串（見下方 helper）。
 */
@Injectable()
export class CasesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- 小工具：把 Prisma 型別轉成 API 字串 ----
  private money(v: { toString(): string } | null | undefined): string | null {
    return v == null ? null : v.toString();
  }
  private isoDate(v: Date | null): string | null {
    return v ? v.toISOString().slice(0, 10) : null; // YYYY-MM-DD
  }

  /**
   * #2 GET /api/cases/summary — 四狀態統計。
   * 用 Prisma groupBy（對應 SQL 的 GROUP BY status）。
   */
  async summary(): Promise<CaseSummary> {
    // PRD 的統計卡片用「分類(Classification)」而非案件流程狀態(CaseStatus)。
    // 分類存在 currentRun 上，所以撈每個案件的 currentRun.classification 來統計。
    const cases = await this.prisma.expenseCase.findMany({
      include: { currentRun: true },
    });
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const c of cases) {
      // 有 run 分類就用分類；沒有(如參照案件)就用案件狀態當 key。
      const key = c.currentRun?.classification ?? c.status;
      byStatus[key] = (byStatus[key] ?? 0) + 1;
      total += 1;
    }
    return { total, byStatus };
  }

  /**
   * #3 GET /api/cases?status= — 案件列表（可選 status 篩選）。
   * status 可能是案件狀態(CaseStatus)或分類(Classification)；這裡用案件的
   * currentRun.classification 當「狀態」顯示，讓前端看到四分類。DEMO 級簡化：
   * 直接讀 currentRun 的 classification / recommendedAction。
   */
  async list(status?: string): Promise<{ items: CaseListItem[] }> {
    const cases = await this.prisma.expenseCase.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        currentRun: true,
        lines: { take: 1, orderBy: { lineNo: "asc" } },
      },
    });

    const items: CaseListItem[] = cases.map((c) => {
      const run = c.currentRun;
      const firstLine = c.lines[0];
      // 「狀態」優先用 run 的分類（NORMAL/EXCEPTION/...），否則用案件狀態。
      const shownStatus = run?.classification ?? c.status;
      return {
        id: c.id,
        caseNumber: c.caseNumber,
        applicantName: c.applicantName,
        summary: firstLine?.description ?? firstLine?.category ?? "",
        category: firstLine?.category ?? null,
        amount: this.money(c.declaredTotal),
        currency: c.currency,
        expenseDate: this.isoDate(firstLine?.expenseDate ?? null),
        status: shownStatus,
        recommendedAction: run?.recommendedAction ?? null,
      };
    });

    // 篩選：比對 run 分類或案件狀態。
    const filtered = status ? items.filter((i) => i.status === status) : items;
    return { items: filtered };
  }

  /**
   * #4 GET /api/cases/:id — 單案完整詳情。
   * 用 include 一次撈出案件 + run + 規則結果 + 證據 + 規範（對應 SQL 的多重 JOIN）。
   */
  async detail(id: string): Promise<CaseDetail> {
    const c = await this.prisma.expenseCase.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { lineNo: "asc" } },
        currentRun: {
          include: {
            policyVersion: true,
            ruleResults: {
              include: {
                ruleDefinition: true,
                policyRule: true,
                evidences: { include: { relatedCase: true } },
              },
            },
          },
        },
      },
    });
    if (!c) throw new NotFoundException(`Case ${id} not found`);

    const run = c.currentRun;
    const firstLine = c.lines[0];

    const checks: CaseCheck[] = (run?.ruleResults ?? []).map((rr) => ({
      checkKey: rr.checkKey,
      ruleCode: rr.ruleCode,
      outcome: rr.outcome,
      isSuspicionOnly: rr.ruleDefinition?.isSuspicionOnly ?? false,
      severity: rr.severity,
      messageKey: rr.messageKey,
      messageParams: (rr.messageParams as Record<string, unknown>) ?? {},
      policyRef: rr.policyRule?.clauseRef ?? null,
      policyText: rr.policyRule?.clauseText ?? null,
      evidence: rr.evidences.map((e) => ({
        snippet: e.snippet,
        relatedCaseId: e.relatedCaseId,
        relatedCaseNumber: e.relatedCase?.caseNumber ?? null,
      })),
    }));

    return {
      id: c.id,
      caseNumber: c.caseNumber,
      summary: firstLine?.description ?? firstLine?.category ?? "",
      status: run?.classification ?? c.status,
      applicant: {
        name: c.applicantName,
        department: null, // schema 未存部門於案件層；DEMO 可留 null 或之後補
        amount: this.money(c.declaredTotal),
        category: firstLine?.category ?? null,
        expenseDate: this.isoDate(firstLine?.expenseDate ?? null),
        applicationDate: this.isoDate(c.applicationDate),
      },
      run: run
        ? {
            runId: run.id,
            classification: run.classification,
            recommendedAction: run.recommendedAction,
            confidenceLevel: run.confidenceLevel,
            policyVersion: run.policyVersion?.version ?? null,
            engineVersion: run.engineVersion,
          }
        : null,
      checks,
      suggestion: run?.recommendedAction
        ? {
            recommendedAction: run.recommendedAction,
            reasonKey: run.summaryKey ?? `suggestion.${run.classification}`,
            reasonParams: (run.summaryParams as Record<string, unknown>) ?? {},
          }
        : null,
    };
  }

  /**
   * #5 GET /api/cases/:id/related — 關聯案件（R7 重複 / R8 拆單）。
   * 從該案件 run 的規則結果證據裡，找出 relatedCase。
   */
  async related(id: string): Promise<RelatedCasesResponse> {
    const evidences = await this.prisma.evidence.findMany({
      where: {
        ruleResult: { run: { caseId: id } },
        relatedCaseId: { not: null },
      },
      include: { relatedCase: true },
    });
    const seen = new Set<string>();
    const related = [];
    for (const e of evidences) {
      if (e.relatedCase && !seen.has(e.relatedCase.id)) {
        seen.add(e.relatedCase.id);
        related.push({
          id: e.relatedCase.id,
          caseNumber: e.relatedCase.caseNumber,
          amount: this.money(e.relatedCase.declaredTotal),
          status: e.relatedCase.status as RelatedCasesResponse["related"][number]["status"],
        });
      }
    }
    return { related };
  }
}
