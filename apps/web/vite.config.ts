import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // 走 @expense-review-agent/shared 的 "development" 條件（TS 原始碼），dev 與 build 一致：
    // 避免打包 shared 的 CommonJS dist，也不必改了 shared 後先 build 才看得到。
    conditions: ["development", "module", "browser"],
  },
  server: {
    // 前端一律打相對路徑 /api，由 dev server 轉發到 NestJS（pnpm dev:api，預設 3000 埠）。
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
