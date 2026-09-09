import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 全域前綴：所有路由都掛在 /api 底下（對齊 docs/API_SPEC.md）。
  app.setGlobalPrefix("api");
  // 開發期允許前端 (Vite, 通常 5173 埠) 跨來源呼叫。
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
