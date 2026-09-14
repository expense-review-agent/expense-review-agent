import { Controller, Get, Param, Query } from "@nestjs/common";
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

  @Get()
  list(@Query("status") status?: string) {
    return this.casesService.list(status);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.casesService.detail(id);
  }

  @Get(":id/related")
  related(@Param("id") id: string) {
    return this.casesService.related(id);
  }
}
