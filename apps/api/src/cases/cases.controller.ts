import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import type {
  AuditTrailResponse,
  BatchCompleteResponse,
  CaseDetail,
  CaseListResponse,
  WorkflowActionResponse,
} from "@expense-review-agent/shared";
import { AuditService } from "../audit/audit.service";
import { CasesService } from "./cases.service";
import { WorkflowService } from "./workflow.service";

/**
 * 案件初審工作台的 API（掛在 /api/cases）。規格見 docs/API_SPEC.md。
 *
 * 路由以案件編號（EXP-2026-001）識別案件。請求內容在 service 以 shared 的
 * zod schema 驗證，這裡只負責轉交。
 */
@Controller("cases")
export class CasesController {
  constructor(
    private readonly cases: CasesService,
    private readonly workflow: WorkflowService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(): Promise<CaseListResponse> {
    return this.cases.list();
  }

  /** 具體路徑要放在 ":caseNumber" 相關路由之前。 */
  @Post("batch-complete")
  @HttpCode(200)
  batchComplete(@Body() body: unknown): Promise<BatchCompleteResponse> {
    return this.workflow.batchComplete(body);
  }

  @Get(":caseNumber")
  detail(@Param("caseNumber") caseNumber: string): Promise<CaseDetail> {
    return this.cases.detail(caseNumber);
  }

  @Post(":caseNumber/actions")
  @HttpCode(201)
  act(
    @Param("caseNumber") caseNumber: string,
    @Body() body: unknown,
  ): Promise<WorkflowActionResponse> {
    return this.workflow.act(caseNumber, body);
  }

  @Get(":caseNumber/audit")
  async auditTrail(@Param("caseNumber") caseNumber: string): Promise<AuditTrailResponse> {
    return this.audit.trail(await this.cases.idOf(caseNumber));
  }
}
