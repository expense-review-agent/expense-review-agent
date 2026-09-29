// 不連資料庫，只驗證 Demo 案例是否自洽。CI 經由 `pnpm --filter api test` 執行。
import { CASES } from "./fixtures.ts";
import { validateFixtures } from "./validate.ts";

const problems = validateFixtures(CASES);
if (problems.length > 0) {
  console.error(`Demo 案例有 ${problems.length} 個問題：\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Demo 案例一致性檢查通過（${CASES.length} 筆案件）。`);
