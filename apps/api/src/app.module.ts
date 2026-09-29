import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthController } from "./health/health.controller";
import { CasesModule } from "./cases/cases.module";

/**
 * AppModule — 應用程式根模組。
 * - PrismaModule : 全域 DB 連線（@Global）
 * - CasesModule  : 案件列表、詳情、人工流程動作、批次完成、稽核軌跡
 */
@Module({
  imports: [PrismaModule, CasesModule],
  controllers: [HealthController],
})
export class AppModule {}
