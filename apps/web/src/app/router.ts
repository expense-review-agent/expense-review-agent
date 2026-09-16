// =============================================================================
// Hash 路由（不引入 router 套件）
//   #/cases        → 案件總覽
//   #/cases/:id    → 案件總覽 + 開啟該案詳情抽屜
//   #/closed       → 已結案案件
//   #/closed/:id   → 已結案案件 + 開啟該案詳情抽屜
//   #/policies     → 費用規範（唯讀，與個別案件無關，故不支援抽屜路徑）
// 抽屜狀態放在網址，重新整理或分享網址都會打開同一案件；頁面也在網址上，
// 所以在已結案頁開著抽屜重新整理不會跳回總覽。
// =============================================================================

import { useSyncExternalStore } from "react";

export type PageName = "queue" | "closed" | "policies";
export type Route = { name: PageName; caseId: string | null };

const PAGE_PATH: Record<PageName, string> = {
  queue: "cases",
  closed: "closed",
  policies: "policies",
};

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getHash(): string {
  return window.location.hash;
}

export function parseRoute(hash: string): Route {
  const match = /^#\/(cases|closed|policies)(?:\/([^/?#]+))?/.exec(hash);
  const segment = match?.[1];
  const name: PageName =
    segment === "closed" ? "closed" : segment === "policies" ? "policies" : "queue";
  // 費用規範是唯讀頁面，與個別案件無關：即使網址後面被加了東西也不開抽屜。
  const caseId = name === "policies" ? null : match?.[2] ? decodeURIComponent(match[2]) : null;
  return { name, caseId };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash);
  return parseRoute(hash);
}

export function pageHref(page: PageName): string {
  return `#/${PAGE_PATH[page]}`;
}

/** 案件連結保留當前頁面，讓已結案頁開啟的抽屜關閉後回到同一頁。 */
export function caseHref(caseId: string, page: PageName = "queue"): string {
  return `#/${PAGE_PATH[page]}/${encodeURIComponent(caseId)}`;
}

export function openCase(caseId: string, page: PageName = "queue"): void {
  window.location.hash = caseHref(caseId, page);
}

export function closeCase(page: PageName = "queue"): void {
  window.location.hash = pageHref(page);
}
