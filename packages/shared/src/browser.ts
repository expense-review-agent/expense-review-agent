// =============================================================================
// 瀏覽器可用的 shared 入口（apps/web 由 "@expense-review-agent/shared/browser" 引入）
//
// 與 index.ts 相同，但不含 hash-chain（它依賴 node:crypto，Vite 在瀏覽器端會把它
// externalize 成一碰就拋錯的 Proxy，dev 模式下整個 app 會載入失敗）。
// 新增前端也要用的匯出時加在這裡；index.ts 會一併轉出。
// =============================================================================

export * from "./domain/vocabulary.ts";
export * from "./domain/types.ts";
export * from "./domain/amount-check.ts";
export * from "./domain/recommendation.ts";
export * from "./domain/workflow-action.ts";
export * from "./domain/review-diff.ts";
export * from "./domain/receipt-reading.ts";
export * from "./api.ts";

export * from "./presentation/labels.ts";
export * from "./presentation/money.ts";
export * from "./presentation/workbench.ts";
