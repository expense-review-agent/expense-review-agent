// =============================================================================
// 案件佇列的檢視管線——篩選、搜尋、排序與計數。
//
// 管線順序是這個模組的核心，各階段不可互換：
//
//   基底（排除 REVIEW_CLOSED）→ 搜尋 → 兩個維度（AND）→ 排序 → 結果筆數
//        ↘ 統計卡片的計數只看這一層，不受後面任何階段影響（固定總覽）
//
// **畫面上只有一個會隨操作變動的數字**：結果筆數。
//
// - 統計卡片的計數在基底層算完，是「待審案件的分類分佈」，不隨篩選或搜尋改變。
//   `classificationCounts` 因此刻意不收 query 參數——不給它機會依賴當前條件，
//   就不可能被寫成會跳動的版本。
// - 結果筆數 = 套用全部條件後的列表長度，由 buildQueueView 一起回傳，呼叫端不自己數。
// - 處理狀態控制項不顯示計數，所以沒有第二組計數要維護。
//
// 為什麼不是「兩組計數交叉反映」（初版設計）：那會讓畫面上有 9 個一直跳動的數字，
// 認知負荷高，而且數字一直變反而讓人不敢信任。現在卡片是情勢總覽（穩定）、
// chip 是純控制項、「共 N 筆」是唯一的真相。
// =============================================================================

import type { CaseListItem } from "../api.ts";
import type { Classification, CaseStatus } from "../enums.ts";

export const QUEUE_CLASSIFICATIONS: readonly Classification[] = [
  "NORMAL",
  "MISSING",
  "EXCEPTION",
  "HUMAN",
];

/** 待審佇列會出現的流程狀態。DRAFT 不進佇列，REVIEW_CLOSED 有專屬頁面。 */
export const QUEUE_CASE_STATUSES: readonly CaseStatus[] = ["QUEUED", "AWAITING_INFO", "DISPOSED"];

/** "ALL" 代表該維度未套用篩選（分類卡片的「全部」與處理狀態的「全部」）。 */
export type ClassificationFilter = Classification | "ALL";
export type CaseStatusFilter = CaseStatus | "ALL";

// 注意：repo 開了 `exactOptionalPropertyTypes`，所以每個 optional 欄位都要明寫
// `| undefined`——呼叫端常把 state 直接展開進來，值可能就是 undefined。
export interface QueueQuery {
  /** 使用者輸入的搜尋字串；未搜尋時給空字串或 undefined。 */
  search?: string | undefined;
  classification?: ClassificationFilter | undefined;
  caseStatus?: CaseStatusFilter | undefined;
}

export type SortKey = "applicationDate" | "caseNumber";
export type SortDirection = "asc" | "desc";

export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

/** 預設排序：申請日期由新到舊。 */
export const DEFAULT_SORT: SortState = { key: "applicationDate", direction: "desc" };

// ---------------------------------------------------------------------------
// 基底
// ---------------------------------------------------------------------------

/** 預設佇列：排除已結案案件（它們有專屬的「已結案案件」頁面）。 */
export function queueItems(items: readonly CaseListItem[]): CaseListItem[] {
  return items.filter((item) => item.caseStatus !== "REVIEW_CLOSED");
}

// ---------------------------------------------------------------------------
// 搜尋
// ---------------------------------------------------------------------------

/**
 * 搜尋字串正規化：去前後空白、轉小寫。空字串（或只有空白）代表未搜尋。
 * 回傳 null 表示「不要篩」，呼叫端不必各自判斷空字串。
 */
export function normalizeSearch(search: string | undefined): string | null {
  const term = (search ?? "").trim().toLocaleLowerCase();
  return term === "" ? null : term;
}

/**
 * 案件是否符合搜尋字串。比對案件編號、申請人、部門與說明，子字串、不分大小寫。
 *
 * 刻意不用 regex：使用者輸入的 `(`、`*`、`[` 在 regex 下會拋錯或意外匹配，
 * `includes` 沒有這個問題。也刻意不做權重排名——ERP 清單的搜尋是「找到我記得的那張單」，
 * 模糊排名反而讓使用者不確定有沒有漏掉。
 */
export function matchesSearch(item: CaseListItem, search: string | undefined): boolean {
  const term = normalizeSearch(search);
  if (term === null) return true;
  const haystack = [item.caseNumber, item.applicantName, item.department, item.summary];
  return haystack.some((field) => (field ?? "").toLocaleLowerCase().includes(term));
}

// ---------------------------------------------------------------------------
// 篩選（搜尋 → 兩個維度）
// ---------------------------------------------------------------------------

function matchesClassification(item: CaseListItem, filter: ClassificationFilter): boolean {
  return filter === "ALL" || item.status === filter;
}

function matchesCaseStatus(item: CaseListItem, filter: CaseStatusFilter): boolean {
  return filter === "ALL" || item.caseStatus === filter;
}

/**
 * 依搜尋與兩個維度篩選（AND）。輸入請先過 `queueItems()`。
 * 不排序——排序是獨立的最後階段（見 `sortQueue`）。
 */
export function filterQueue(
  items: readonly CaseListItem[],
  query: QueueQuery = {},
): CaseListItem[] {
  const { search, classification = "ALL", caseStatus = "ALL" } = query;
  return items.filter(
    (item) =>
      matchesSearch(item, search) &&
      matchesClassification(item, classification) &&
      matchesCaseStatus(item, caseStatus),
  );
}

// ---------------------------------------------------------------------------
// 統計卡片的計數（固定總覽）
// ---------------------------------------------------------------------------

export interface ClassificationCounts {
  counts: Record<Classification, number>;
  /** 待審總數 = 四個分類相加（也就是「全部」卡片的數字）。 */
  total: number;
}

/**
 * 統計卡片的計數：待審案件的分類分佈。
 *
 * **刻意不收 query 參數。** 這是「整體情勢」的固定總覽，不隨處理狀態篩選或搜尋改變——
 * 儀表板數字一直跳動會讓人不敢信任它。要讓它跟著篩選走必須先改簽名，
 * 不會有人「順手」改掉（測試也釘住這件事）。
 *
 * 當前結果的筆數由 `buildQueueView().resultCount` 負責，那是畫面上唯一會動的數字。
 */
export function classificationCounts(items: readonly CaseListItem[]): ClassificationCounts {
  const counts = Object.fromEntries(QUEUE_CLASSIFICATIONS.map((c) => [c, 0])) as Record<
    Classification,
    number
  >;
  for (const item of items) {
    const key = item.status as Classification;
    if (key in counts) counts[key] = (counts[key] ?? 0) + 1;
  }
  const total = QUEUE_CLASSIFICATIONS.reduce((sum, c) => sum + (counts[c] ?? 0), 0);
  return { counts, total };
}

// ---------------------------------------------------------------------------
// 排序（最後階段，不影響計數）
// ---------------------------------------------------------------------------

const NUMERIC_SEGMENT = /(\d+)/;

/**
 * 自然順序比較：把字串切成「非數字段 / 數字段」，數字段以數值比較。
 * 純字典序會讓 `EXP-2026-10` 排在 `EXP-2026-9` 之前。現在的編號寬度一致所以看不出來，
 * 但編號格式是客戶端決定的，不值得賭。
 */
function compareNatural(a: string, b: string): number {
  const segmentsA = a.split(NUMERIC_SEGMENT).filter((s) => s !== "");
  const segmentsB = b.split(NUMERIC_SEGMENT).filter((s) => s !== "");
  const len = Math.min(segmentsA.length, segmentsB.length);
  for (let i = 0; i < len; i += 1) {
    const segA = segmentsA[i] as string;
    const segB = segmentsB[i] as string;
    const numA = Number(segA);
    const numB = Number(segB);
    const bothNumeric = !Number.isNaN(numA) && !Number.isNaN(numB) && segA !== "" && segB !== "";
    if (bothNumeric) {
      if (numA !== numB) return numA - numB;
    } else {
      const cmp = segA.localeCompare(segB);
      if (cmp !== 0) return cmp;
    }
  }
  return segmentsA.length - segmentsB.length;
}

function sortValue(item: CaseListItem, key: SortKey): string | null {
  return key === "applicationDate" ? item.applicationDate : item.caseNumber;
}

/**
 * 依排序鍵與方向排序。缺值一律排在末尾（不論升降冪）——ERP 清單的慣例，
 * 也避免「排序之後那筆單不見了」這種最糟的體驗；缺值的案件仍在結果中。
 *
 * `Array.prototype.sort` 在現代引擎保證穩定，所以同值的案件維持原本次序，
 * 切換方向時不會亂跳。輸入不被就地修改。
 */
export function sortQueue(
  items: readonly CaseListItem[],
  sort: SortState = DEFAULT_SORT,
): CaseListItem[] {
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const valueA = sortValue(a, sort.key);
    const valueB = sortValue(b, sort.key);
    // 缺值排末尾，與方向無關，所以不乘 factor。
    if (valueA === null && valueB === null) return 0;
    if (valueA === null) return 1;
    if (valueB === null) return -1;
    const cmp =
      sort.key === "caseNumber" ? compareNatural(valueA, valueB) : valueA.localeCompare(valueB);
    return cmp * factor;
  });
}

/** 點擊欄位標題後的新排序狀態：同一欄切換方向，換欄則以該欄的預設方向開始。 */
export function toggleSort(current: SortState, key: SortKey): SortState {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  // 日期預設由新到舊（最近的先看），編號預設由小到大。
  return { key, direction: key === "applicationDate" ? "desc" : "asc" };
}

// ---------------------------------------------------------------------------
// 一次算完（呼叫端只要這個）
// ---------------------------------------------------------------------------

export interface QueueView {
  /** 套用搜尋 + 兩個維度 + 排序後要顯示的列表。 */
  items: CaseListItem[];
  /** 統計卡片的固定計數（待審案件的分類分佈，不隨 query 改變）。 */
  classification: ClassificationCounts;
  /**
   * 當前結果的筆數——畫面上唯一會隨操作變動的數字。
   * 就是 `items.length`，一起回傳讓呼叫端沒有自己數錯的機會。
   */
  resultCount: number;
  /** 有套用任何搜尋或篩選（決定空狀態要不要顯示「清除」入口）。 */
  isNarrowed: boolean;
  /** 有套用搜尋（空狀態文案要區分「沒有案件」與「沒有符合搜尋的案件」）。 */
  isSearching: boolean;
}

/**
 * 從原始列表算出整個檢視。呼叫端不必知道管線順序，也就不可能把順序弄反。
 */
export function buildQueueView(
  rawItems: readonly CaseListItem[],
  query: QueueQuery = {},
  sort: SortState = DEFAULT_SORT,
): QueueView {
  const base = queueItems(rawItems);
  const { search, classification = "ALL", caseStatus = "ALL" } = query;
  const items = sortQueue(filterQueue(base, { search, classification, caseStatus }), sort);
  return {
    items,
    // 固定總覽：只看基底，不看 query
    classification: classificationCounts(base),
    resultCount: items.length,
    isNarrowed:
      normalizeSearch(search) !== null || classification !== "ALL" || caseStatus !== "ALL",
    isSearching: normalizeSearch(search) !== null,
  };
}

export interface ClosedView {
  items: CaseListItem[];
  /** 同上：唯一會變動的數字。 */
  resultCount: number;
  isSearching: boolean;
}

/**
 * 已結案案件頁面的檢視：資料已由後端依流程狀態取回，這裡只套用搜尋與排序。
 * 刻意沿用同一組 `matchesSearch` 與 `sortQueue`，兩頁的行為因此不可能漂移。
 */
export function buildClosedView(
  rawItems: readonly CaseListItem[],
  query: Pick<QueueQuery, "search"> = {},
  sort: SortState = DEFAULT_SORT,
): ClosedView {
  const items = sortQueue(
    rawItems.filter((item) => matchesSearch(item, query.search)),
    sort,
  );
  return {
    items,
    resultCount: items.length,
    isSearching: normalizeSearch(query.search) !== null,
  };
}
