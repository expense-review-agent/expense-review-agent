import { Controller, Get, Param, Query, BadRequestException } from "@nestjs/common";
import { caseHistoryScopeSchema, caseStatusSchema } from "@expense-review-agent/shared";
import { CasesService } from "./cases.service";

/**
 * CasesController — 案件相關路由（掛在 /api/cases 底下）。
 *
 * 學習重點：
 * - @Get("summary") → GET /api/cases/summary
 * - @Get() → GET /api/cases（@Query 取 ?status=）
 * - @Get(":id") → GET /api/cases/:id（@Param 取路徑上的 id）
 * - 注意路由順序：具體路徑 "summary" 要放在 ":id" 之前，否則 summary 會被當成 id。
 */
@Controller("cases")
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Get("summary")
  summary() {
    return this.casesService.summary();
  }

  /**
   * status 與 caseStatus 是兩個獨立參數（見 CasesService.list 的註解）：
   * status 比對分類與流程狀態的合併值，caseStatus 只比對流程狀態。
   */
  @Get()
  list(@Query("status") status?: string, @Query("caseStatus") caseStatus?: string) {
    const parsedCaseStatus = caseStatus ? caseStatusSchema.safeParse(caseStatus) : null;
    if (parsedCaseStatus && !parsedCaseStatus.success) {
      throw new BadRequestException(`Unknown caseStatus "${caseStatus}"`);
    }
    return this.casesService.list(status, parsedCaseStatus?.data);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.casesService.detail(id);
  }

  @Get(":id/related")
  related(@Param("id") id: string) {
    return this.casesService.related(id);
  }

  /** 申請人／部門申請紀錄。scope 必須是 applicant 或 department。 */
  @Get(":id/history")
  history(@Param("id") id: string, @Query("scope") scope?: string) {
    const parsed = caseHistoryScopeSchema.safeParse(scope);
    if (!parsed.success) {
      throw new BadRequestException(`scope must be "applicant" or "department"`);
    }
    return this.casesService.history(id, parsed.data);
  }
}
