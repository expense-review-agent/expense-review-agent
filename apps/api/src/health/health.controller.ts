import { Controller, Get } from "@nestjs/common";

/**
 * HealthController — 最簡單的一支 API，用來確認後端有起來。
 *
 * 學習重點（一個請求的完整旅程，最小版）：
 * - @Controller("health") 定義路由前綴。搭配 main.ts 的全域前綴 /api，
 *   完整路徑是 GET /api/health。
 * - @Get() 對應 HTTP GET。方法回傳的物件，NestJS 會自動序列化成 JSON。
 */
@Controller("health")
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: "ok" };
  }
}
