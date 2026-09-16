// =============================================================================
// 瀏覽器可用的 shared 入口（apps/web 由 "@expense-review-agent/shared/browser" 引入）
//
// 與 index.ts 相同，但不含 hash-chain（它依賴 node:crypto，Vite 在瀏覽器端會把它
// externalize 成一碰就拋錯的 Proxy，dev 模式下整個 app 會載入失敗）。
// 新增前端也要用的匯出時加在這裡；index.ts 會一併轉出。
// =============================================================================

export * from "./enums.ts";
export * from "./domain/disposition.ts";
export * from "./api.ts";

// Reviewer 工作台：i18n 文案與呈現邏輯（純函式，前端 import 使用、不另寫一份）
export * from "./i18n/format.ts";
export { zhTW } from "./i18n/zh-TW.ts";
export * from "./presentation/check-view.ts";
export * from "./presentation/disposition-options.ts";
export * from "./presentation/money.ts";
export * from "./presentation/queue-view.ts";
export * from "./presentation/case-history.ts";
