// =============================================================================
// 佇列的篩選、搜尋、排序與計數邏輯都在 packages/shared 的 presentation/queue-view，
// 這裡只轉出，**不在 web 保留第二份實作**。
//
// 理由：web 沒有測試框架（刻意），而交叉計數（兩個維度互相影響、再加上搜尋）是最容易
// 寫錯又最難用眼睛看出來的地方。放在 shared 才能用 node --test 窮舉。
// =============================================================================

export {
  DEFAULT_SORT,
  QUEUE_CASE_STATUSES,
  QUEUE_CLASSIFICATIONS,
  buildClosedView,
  buildQueueView,
  queueItems,
  toggleSort,
} from "@expense-review-agent/shared/browser";

export type {
  CaseStatusFilter,
  ClassificationFilter,
  ClosedView,
  QueueView,
  SortKey,
  SortState,
} from "@expense-review-agent/shared/browser";
