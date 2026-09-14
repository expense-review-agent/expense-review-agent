import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * PrismaModule — 提供 PrismaService 給整個 app。
 *
 * 學習重點：
 * - @Global() 讓這個 module 匯出的東西全專案可用，不必每個 module 都 import 一次。
 * - exports: [PrismaService] 代表其他 module 注入時拿得到它。
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
