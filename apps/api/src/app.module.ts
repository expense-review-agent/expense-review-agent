import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthController } from "./health/health.controller";
import { CasesModule } from "./cases/cases.module";
import { PoliciesModule } from "./policies/policies.module";
import { RunsModule } from "./runs/runs.module";
import { ReviewModule } from "./review/review.module";

/**
 * AppModule — 應用程式根模組，組裝所有功能模組。
 *
 * imports 的每個 module 對應一組 API：
 * - PrismaModule    : 全域 DB 連線（@Global）
 * - CasesModule     : #2~#5 案件查詢
 * - PoliciesModule  : #7 費用規範
 * - RunsModule      : #8/#9 非同步 run
 * - ReviewModule    : #6/#10/#11 稽核軌跡 + 人工處置 + 主管稽核
 * HealthController (#1) 較單純，直接掛在根 module。
 */
@Module({
  imports: [PrismaModule, CasesModule, PoliciesModule, RunsModule, ReviewModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
