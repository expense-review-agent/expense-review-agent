import { existsSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

// 讀取 apps/api/.env（例如 GEMINI_API_KEY）。已存在的環境變數優先，不會被覆寫。
if (existsSync(".env")) process.loadEnvFile(".env");

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 全域前綴：所有路由都掛在 /api 底下（對齊 docs/API_SPEC.md）。
  app.setGlobalPrefix("api");
  // 開發期允許前端 (Vite, 通常 5173 埠) 跨來源呼叫。
  app.enableCors();
  // 關閉時等背景讀取結束（ReadingsService）
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
