// =============================================================================
// messageKey + messageParams → 顯示文字
//
// 保證：永遠不把原始 messageKey 或空字串顯示給使用者。查不到時依序改用
// fallbackKey、最後回傳通用句。
// =============================================================================

import { zhTW } from "./zh-TW.ts";

export type MessageParams = Readonly<Record<string, unknown>>;

const GENERIC_KEY = "message.generic";

/** 查表並插值；鍵不存在時回傳 null（供需要判斷「有沒有文案」的呼叫端使用）。 */
export function lookupMessage(key: string, params: MessageParams = {}): string | null {
  const template = zhTW[key];
  if (template === undefined) return null;
  return interpolate(template, params);
}

/**
 * 查表並插值。鍵不存在時改用 `fallbackKey`，再不存在就回傳通用句。
 * 回傳值一定是可顯示的中文句子。
 */
export function t(key: string, params: MessageParams = {}, fallbackKey?: string): string {
  return (
    lookupMessage(key, params) ??
    (fallbackKey === undefined ? null : lookupMessage(fallbackKey, params)) ??
    (zhTW[GENERIC_KEY] as string)
  );
}

/** `{name}` → params.name。缺少的參數保留空字串，不把 `{name}` 字樣露給使用者。 */
function interpolate(template: string, params: MessageParams): string {
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === null || value === undefined) return "";
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  });
}
