import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * PrismaService — 全專案共用的資料庫連線。
 *
 * 學習重點（NestJS 概念）：
 * - @Injectable() 讓這個 class 可以被「依賴注入」到其他 Service/Controller。
 * - 繼承 PrismaClient，所以其他地方注入這個 service 後，可直接用
 *   this.prisma.expenseCase.findMany() 等 Prisma 方法。
 * - OnModuleInit / OnModuleDestroy 是 NestJS 的生命週期鉤子：
 *   app 啟動時連線 DB、關閉時斷線。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
