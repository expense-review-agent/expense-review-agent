import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CaseSummary,
  CaseListItem,
  CaseDetail,
  CaseCheck,
  RelatedCasesResponse,
  CaseHistoryResponse,
  CaseHistoryScope,
  CaseStatus,
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
   * #3 GET /api/cases?status=&caseStatus= — 案件列表（兩個獨立的篩選參數）。
   *
   * - `status`：既有參數。比對的是「有 run 用 Agent 分類、無 run 用流程狀態」的**合併值**，
   *   前端與既有 spec 都依賴這個語意，不能改。
   * - `caseStatus`：流程狀態篩選，直接下在 Prisma `where` 上（DB 層篩，不是撈回後過濾）。
   *   不能用 `status` 篩流程狀態——帶有 Agent run 的案件會因分類覆蓋而篩不到，
   *   `REVIEW_CLOSED` 的參照案件就是這個情況。
   *
   * 兩者同時給定時為 AND。
   */
  async list(status?: string, caseStatus?: CaseStatus): Promise<{ items: CaseListItem[] }> {
    const cases = await this.prisma.expenseCase.findMany({
      ...(caseStatus ? { where: { status: caseStatus } } : {}),
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
        department: c.applicantDepartment, // 時點快照；未記錄時為 null
        summary: firstLine?.description ?? firstLine?.category ?? "",
        category: firstLine?.category ?? null,
        amount: this.money(c.declaredTotal),
        currency: c.currency,
        expenseDate: this.isoDate(firstLine?.expenseDate ?? null),
        applicationDate: this.isoDate(c.applicationDate), // 列表日期欄與排序依據
        status: shownStatus,
        caseStatus: c.status, // 流程狀態，與分類分開回傳
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
        // 最新一筆處置（append-only 紀錄的唯讀投影）。只取一筆：詳情只需要「誰讓這個案件
        // 變成現在這個狀態」；完整歷程屬稽核軌跡頁。
        dispositions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { actor: true },
        },
      },
    });
    if (!c) throw new NotFoundException(`Case ${id} not found`);

    const run = c.currentRun;
    const firstLine = c.lines[0];
    const latestDisposition = c.dispositions[0] ?? null;

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
      caseStatus: c.status, // 流程狀態，前端依此判斷是否仍待處置
      applicant: {
        name: c.applicantName,
        department: c.applicantDepartment, // 時點快照；未記錄時為 null
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
      // 徽章直接讀處置紀錄的固化值。**不得**在此呼叫 deriveConsistencyFlag 重算——
      // Policy 或規則改版會讓歷史徽章翻臉（CLAUDE.md 已定案的決策）。
      disposition: latestDisposition
        ? {
            actorName: latestDisposition.actor.displayName,
            decidedAt: latestDisposition.createdAt.toISOString(),
            action: latestDisposition.action,
            consistencyFlag: latestDisposition.consistencyFlag,
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

  /**
   * GET /api/cases/:id/history?scope=applicant|department — 申請人／部門申請紀錄。
   *
   * 以**案件為查詢起點**，而不是把姓名放進 URL：申請人沒有穩定識別（`applicantCode`
   * 是 optional），姓名進 URL 會遇到編碼與同名歧義，也把「用哪個欄位比對」這個領域
   * 決定推給前端。有 `applicantCode` 時優先用它，否則退回姓名。
   *
   * 唯讀投影：只有既有案件欄位。**不得**加入風險分數、頻率統計或任何結論性標記——
   * 跨案件風險判定屬 M2（specs/review-api 明文禁止）。
   */
  async history(id: string, scope: CaseHistoryScope): Promise<CaseHistoryResponse> {
    const origin = await this.prisma.expenseCase.findUnique({ where: { id } });
    if (!origin) throw new NotFoundException(`Case ${id} not found`);

    let where: Prisma.ExpenseCaseWhereInput;
    let subject: string;
    if (scope === "department") {
      if (!origin.applicantDepartment?.trim()) {
        // 前端本來就不該讓沒有部門的欄位可點選；這裡是契約層的防線。
        throw new BadRequestException("Case has no department recorded");
      }
      subject = origin.applicantDepartment;
      where = {
        organizationId: origin.organizationId,
        applicantDepartment: origin.applicantDepartment,
      };
    } else {
      subject = origin.applicantName;
      where = {
        organizationId: origin.organizationId,
        ...(origin.applicantCode
          ? { applicantCode: origin.applicantCode }
          : { applicantName: origin.applicantName }),
      };
    }

    const cases = await this.prisma.expenseCase.findMany({
      where,
      orderBy: [{ applicationDate: "desc" }, { caseNumber: "asc" }],
      include: { currentRun: true },
    });

    return {
      scope,
      subject,
      items: cases.map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        applicationDate: this.isoDate(c.applicationDate),
        amount: this.money(c.declaredTotal),
        currency: c.currency,
        status: c.currentRun?.classification ?? c.status,
        caseStatus: c.status,
        isCurrent: c.id === origin.id,
      })),
    };
  }
}
