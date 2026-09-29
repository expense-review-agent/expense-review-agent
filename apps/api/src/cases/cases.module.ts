import { Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { CasesController } from "./cases.controller";
import { CasesService } from "./cases.service";
import { WorkflowService } from "./workflow.service";

@Module({
  controllers: [CasesController],
  providers: [CasesService, WorkflowService, AuditService],
})
export class CasesModule {}
