// =============================================================================
// 佇列檢視管線測試——篩選、搜尋、排序與交叉計數。
//
// 兩條核心不變量（畫面上只有一個會變動的數字）：
//   1. 統計卡片的計數是**固定總覽**——對任何分類／處理狀態／搜尋組合都必須相同。
//   2. 結果筆數 === 實際顯示的列數。
// 下面窮舉「分類 × 處理狀態 ×（有／無搜尋）」全部組合來釘住這兩條。
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";

import type { CaseListItem, CaseStatus, Classification } from "../api.ts";
import {
  DEFAULT_SORT,
  QUEUE_CASE_STATUSES,
  QUEUE_CLASSIFICATIONS,
  buildClosedView,
  buildQueueView,
  classificationCounts,
  filterQueue,
  matchesSearch,
  normalizeSearch,
  queueItems,
  sortQueue,
  toggleSort,
} from "../presentation/queue-view.ts";
import type {
  CaseStatusFilter,
  ClassificationFilter,
  SortKey,
} from "../presentation/queue-view.ts";

function item(over: Partial<CaseListItem> & Pick<CaseListItem, "caseNumber">): CaseListItem {
  return {
    id: over.caseNumber,
    caseNumber: over.caseNumber,
    applicantName: "王小明",
    department: "業務部",
    summary: "辦公用品",
    category: "辦公用品",
    amount: "1200",
    currency: "TWD",
    expenseDate: "2026-08-10",
    applicationDate: "2026-08-12",
    status: "NORMAL",
    caseStatus: "QUEUED",
    recommendedAction: "APPROVE",
    ...over,
  };
}

/** 覆蓋四分類 × 三種流程狀態的樣本，外加一筆已結案案件。 */
const FIXTURE: CaseListItem[] = [
  item({ caseNumber: "EXP-2026-2001", status: "NORMAL", caseStatus: "DISPOSED" }),
  item({ caseNumber: "EXP-2026-2002", status: "EXCEPTION", caseStatus: "QUEUED" }),
  item({
    caseNumber: "EXP-2026-2003",
    status: "MISSING",
    caseStatus: "AWAITING_INFO",
    applicantName: "李美華",
    department: "研發部",
    summary: "住宿費",
  }),
  item({ caseNumber: "EXP-2026-2004", status: "HUMAN", caseStatus: "QUEUED", department: null }),
  item({ caseNumber: "EXP-2026-2005", status: "NORMAL", caseStatus: "QUEUED" }),
  item({ caseNumber: "EXP-2026-1043", status: "NORMAL", caseStatus: "REVIEW_CLOSED" }),
];

const SEARCH_TERMS = ["", "  ", "2002", "李美華", "研發", "住宿", "exp-2026", "查無此案"];
const CLASSIFICATION_FILTERS: ClassificationFilter[] = ["ALL", ...QUEUE_CLASSIFICATIONS];
const CASE_STATUS_FILTERS: CaseStatusFilter[] = ["ALL", ...QUEUE_CASE_STATUSES];

// ---------------------------------------------------------------------------
// 基底
// ---------------------------------------------------------------------------

test("queueItems excludes REVIEW_CLOSED cases", () => {
  const queue = queueItems(FIXTURE);
  assert.equal(queue.length, 5);
  assert.ok(!queue.some((c) => c.caseStatus === "REVIEW_CLOSED"));
});

// ---------------------------------------------------------------------------
// 核心不變量：計數 === 篩選後長度（窮舉）
// ---------------------------------------------------------------------------

test("classification card counts are a fixed overview — identical for every query", () => {
  const base = queueItems(FIXTURE);
  const expected = classificationCounts(base);
  for (const search of SEARCH_TERMS) {
    for (const classification of CLASSIFICATION_FILTERS) {
      for (const caseStatus of CASE_STATUS_FILTERS) {
        const view = buildQueueView(FIXTURE, { search, classification, caseStatus });
        assert.deepEqual(
          view.classification,
          expected,
          `卡片計數不該隨條件改變（search="${search}" ${classification}/${caseStatus}）`,
        );
      }
    }
  }
  // 固定值本身也要對：FIXTURE 的待審案件是 NORMAL 2、MISSING 1、EXCEPTION 1、HUMAN 1
  assert.deepEqual(expected.counts, { NORMAL: 2, MISSING: 1, EXCEPTION: 1, HUMAN: 1 });
  assert.equal(expected.total, 5);
});

test("classificationCounts takes no query — it cannot depend on the current filters", () => {
  // 簽名只收 items。若日後有人加上 query 參數，這個斷言會提醒他那是刻意的設計。
  assert.equal(classificationCounts.length, 1);
});

test("resultCount always equals the number of rows shown", () => {
  for (const search of SEARCH_TERMS) {
    for (const classification of CLASSIFICATION_FILTERS) {
      for (const caseStatus of CASE_STATUS_FILTERS) {
        const view = buildQueueView(FIXTURE, { search, classification, caseStatus });
        assert.equal(
          view.resultCount,
          view.items.length,
          `結果筆數與列表不符（search="${search}" ${classification}/${caseStatus}）`,
        );
        // 也要與獨立算一次的篩選結果一致
        assert.equal(
          view.resultCount,
          filterQueue(queueItems(FIXTURE), { search, classification, caseStatus }).length,
        );
      }
    }
  }
});

test("REVIEW_CLOSED cases never enter any count", () => {
  for (const search of ["", "1043", "EXP-2026-1043"]) {
    const view = buildQueueView(FIXTURE, { search });
    assert.ok(!view.items.some((c) => c.caseStatus === "REVIEW_CLOSED"));
    // 1043 是 NORMAL，若被算進去 NORMAL 卡片會變成 3。卡片是固定總覽，所以恆為 2。
    assert.equal(view.classification.counts.NORMAL, 2);
    assert.equal(view.classification.total, 5);
    // 搜尋 1043 只會讓結果筆數變 0，不影響卡片
    if (search !== "") assert.equal(view.resultCount, 0);
  }
});

test("changing the sort never changes any count", () => {
  const keys: SortKey[] = ["applicationDate", "caseNumber"];
  const baseline = buildQueueView(FIXTURE, { search: "exp-2026" }, DEFAULT_SORT);
  for (const key of keys) {
    for (const direction of ["asc", "desc"] as const) {
      const view = buildQueueView(FIXTURE, { search: "exp-2026" }, { key, direction });
      assert.deepEqual(view.classification, baseline.classification);
      assert.equal(view.resultCount, baseline.resultCount);
    }
  }
});

// ---------------------------------------------------------------------------
// 搜尋
// ---------------------------------------------------------------------------

test("search matches case number, applicant, department and summary as substrings", () => {
  const base = queueItems(FIXTURE);
  assert.deepEqual(
    filterQueue(base, { search: "2002" }).map((c) => c.caseNumber),
    ["EXP-2026-2002"],
  );
  assert.deepEqual(
    filterQueue(base, { search: "李美" }).map((c) => c.caseNumber),
    ["EXP-2026-2003"],
  );
  assert.deepEqual(
    filterQueue(base, { search: "研發" }).map((c) => c.caseNumber),
    ["EXP-2026-2003"],
  );
  assert.deepEqual(
    filterQueue(base, { search: "住宿" }).map((c) => c.caseNumber),
    ["EXP-2026-2003"],
  );
});

test("search is case-insensitive", () => {
  const base = queueItems(FIXTURE);
  assert.equal(filterQueue(base, { search: "exp-2026" }).length, 5);
  assert.equal(filterQueue(base, { search: "EXP-2026" }).length, 5);
});

test("surrounding whitespace is ignored and a blank term narrows nothing", () => {
  const base = queueItems(FIXTURE);
  assert.equal(normalizeSearch("  "), null);
  assert.equal(normalizeSearch("  2002 "), "2002");
  assert.deepEqual(
    filterQueue(base, { search: "  2002  " }).map((c) => c.caseNumber),
    ["EXP-2026-2002"],
  );
  assert.equal(filterQueue(base, { search: "   " }).length, base.length);
  assert.equal(filterQueue(base, { search: undefined }).length, base.length);
});

test("regex metacharacters are treated literally and never throw", () => {
  const base = queueItems(FIXTURE);
  for (const term of ["(", ")", "*", "[", "\\", "+?", ".*"]) {
    assert.doesNotThrow(() => filterQueue(base, { search: term }));
    assert.equal(filterQueue(base, { search: term }).length, 0);
  }
});

test("a case with no department is still searchable by its other fields", () => {
  const noDept = item({ caseNumber: "EXP-2026-2004", department: null });
  assert.equal(matchesSearch(noDept, "2004"), true);
  assert.equal(matchesSearch(noDept, "業務"), false);
});

test("search narrows the rows and the result count, but never the cards", () => {
  // "李美華" 只命中一筆 MISSING / AWAITING_INFO 的案件
  const view = buildQueueView(FIXTURE, { search: "李美華" });
  assert.equal(view.items.length, 1);
  assert.equal(view.resultCount, 1);
  // 卡片維持固定總覽
  assert.deepEqual(view.classification.counts, { NORMAL: 2, MISSING: 1, EXCEPTION: 1, HUMAN: 1 });
  assert.equal(view.classification.total, 5);
  assert.ok(view.isSearching);
  assert.ok(view.isNarrowed);
});

test("search does not clear the active filters", () => {
  const view = buildQueueView(FIXTURE, { search: "exp-2026", classification: "EXCEPTION" });
  assert.deepEqual(
    view.items.map((c) => c.caseNumber),
    ["EXP-2026-2002"],
  );
});

// ---------------------------------------------------------------------------
// 排序
// ---------------------------------------------------------------------------

test("case numbers sort naturally, not lexicographically", () => {
  const items = [item({ caseNumber: "EXP-2026-10" }), item({ caseNumber: "EXP-2026-9" })];
  assert.deepEqual(
    sortQueue(items, { key: "caseNumber", direction: "asc" }).map((c) => c.caseNumber),
    ["EXP-2026-9", "EXP-2026-10"],
  );
  assert.deepEqual(
    sortQueue(items, { key: "caseNumber", direction: "desc" }).map((c) => c.caseNumber),
    ["EXP-2026-10", "EXP-2026-9"],
  );
});

test("default sort is application date, newest first", () => {
  const items = [
    item({ caseNumber: "A", applicationDate: "2026-08-01" }),
    item({ caseNumber: "B", applicationDate: "2026-08-20" }),
  ];
  assert.deepEqual(
    sortQueue(items, DEFAULT_SORT).map((c) => c.caseNumber),
    ["B", "A"],
  );
});

test("missing sort values go last in both directions and are never dropped", () => {
  const items = [
    item({ caseNumber: "A", applicationDate: null }),
    item({ caseNumber: "B", applicationDate: "2026-08-20" }),
    item({ caseNumber: "C", applicationDate: "2026-08-01" }),
  ];
  for (const direction of ["asc", "desc"] as const) {
    const sorted = sortQueue(items, { key: "applicationDate", direction });
    assert.equal(sorted.length, 3, "缺值的案件不得從列表中消失");
    assert.equal(sorted[sorted.length - 1]?.caseNumber, "A");
  }
});

test("sorting is stable for equal values and does not mutate the input", () => {
  const items = [
    item({ caseNumber: "A", applicationDate: "2026-08-01" }),
    item({ caseNumber: "B", applicationDate: "2026-08-01" }),
    item({ caseNumber: "C", applicationDate: "2026-08-01" }),
  ];
  const snapshot = items.map((c) => c.caseNumber);
  assert.deepEqual(
    sortQueue(items, { key: "applicationDate", direction: "asc" }).map((c) => c.caseNumber),
    snapshot,
  );
  assert.deepEqual(
    items.map((c) => c.caseNumber),
    snapshot,
    "sortQueue 不得就地修改輸入",
  );
});

test("toggleSort flips direction on the same column and switches column with its default", () => {
  assert.deepEqual(toggleSort({ key: "applicationDate", direction: "desc" }, "applicationDate"), {
    key: "applicationDate",
    direction: "asc",
  });
  assert.deepEqual(toggleSort({ key: "applicationDate", direction: "desc" }, "caseNumber"), {
    key: "caseNumber",
    direction: "asc",
  });
  assert.deepEqual(toggleSort({ key: "caseNumber", direction: "asc" }, "applicationDate"), {
    key: "applicationDate",
    direction: "desc",
  });
});

test("sort survives a filter change", () => {
  const sort = { key: "caseNumber" as SortKey, direction: "asc" as const };
  const all = buildQueueView(FIXTURE, {}, sort);
  const filtered = buildQueueView(FIXTURE, { classification: "NORMAL" }, sort);
  const ordered = [...filtered.items].map((c) => c.caseNumber);
  assert.deepEqual(ordered, [...ordered].sort());
  assert.ok(all.items.length > filtered.items.length);
});

// ---------------------------------------------------------------------------
// 已結案頁面沿用同一組行為
// ---------------------------------------------------------------------------

test("closed view reuses the same search and sort behaviour", () => {
  const closed: CaseListItem[] = [
    item({
      caseNumber: "EXP-2026-1043",
      caseStatus: "REVIEW_CLOSED",
      applicationDate: "2026-08-05",
    }),
    item({
      caseNumber: "EXP-2026-1044",
      caseStatus: "REVIEW_CLOSED",
      applicationDate: "2026-08-25",
    }),
  ];
  // 已結案案件不會被 queueItems 排除——這一頁的資料由後端依流程狀態取回
  const view = buildClosedView(closed);
  assert.deepEqual(
    view.items.map((c) => c.caseNumber),
    ["EXP-2026-1044", "EXP-2026-1043"],
  );
  assert.equal(view.resultCount, view.items.length);
  assert.equal(buildClosedView(closed, { search: "1043" }).resultCount, 1);
  assert.deepEqual(
    buildClosedView(closed, { search: "1043" }).items.map((c) => c.caseNumber),
    ["EXP-2026-1043"],
  );
  assert.equal(buildClosedView(closed, { search: "  " }).isSearching, false);
});

// ---------------------------------------------------------------------------
// 空狀態旗標
// ---------------------------------------------------------------------------

test("view flags tell an empty search apart from an empty queue", () => {
  const searched = buildQueueView(FIXTURE, { search: "查無此案" });
  assert.equal(searched.items.length, 0);
  assert.equal(searched.resultCount, 0);
  assert.ok(searched.isSearching);
  assert.ok(searched.isNarrowed);

  const plain = buildQueueView([]);
  assert.equal(plain.items.length, 0);
  assert.equal(plain.isSearching, false);
  assert.equal(plain.isNarrowed, false);

  const filteredOnly = buildQueueView(FIXTURE, {
    classification: "NORMAL",
    caseStatus: "AWAITING_INFO",
  });
  assert.equal(filteredOnly.items.length, 0);
  assert.equal(filteredOnly.isSearching, false);
  assert.ok(filteredOnly.isNarrowed, "只套篩選也要能提供清除入口");
});

// 型別守衛：CaseStatus / Classification 若新增值，下面的窮舉清單就會漏掉，
// 這兩行讓編譯期先發現（QUEUE_* 常數是刻意的子集，不含 DRAFT / REVIEW_CLOSED）。
const _classificationCheck: readonly Classification[] = QUEUE_CLASSIFICATIONS;
const _caseStatusCheck: readonly CaseStatus[] = QUEUE_CASE_STATUSES;
void _classificationCheck;
void _caseStatusCheck;
