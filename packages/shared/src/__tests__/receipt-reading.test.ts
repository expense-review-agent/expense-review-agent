// 單據讀取結果的規則（specs/receipt-reading.md 4.2–4.6、5.1、5.2）。

import { test } from "node:test";
import assert from "node:assert/strict";

import { amountChecksForReading, extractionProblems } from "../domain/receipt-reading.ts";
import type { ReceiptExtraction } from "../domain/receipt-reading.ts";

const ok = (value: string) => ({ status: "RECOGNIZED" as const, value });
const unreadable = { status: "UNREADABLE" as const, value: null };
const absent = { status: "NOT_ON_RECEIPT" as const, value: null };

function extraction(overrides: Partial<ReceiptExtraction> = {}): ReceiptExtraction {
  return {
    vendor: ok("城際客運（模擬）"),
    issueDate: ok("2026-09-18"),
    totalAmount: ok("1480"),
    currency: ok("TWD"),
    documentNumber: ok("EV-003"),
    taxId: ok("00000000"),
    ...overrides,
  };
}

// ---- 擷取結果本身的格式 -------------------------------------------------------

test("格式正確的擷取結果沒有問題", () => {
  assert.deepEqual(extractionProblems(extraction()), []);
  assert.deepEqual(extractionProblems(extraction({ taxId: absent, vendor: unreadable })), []);
});

test("已辨識的欄位必須有值；無法辨識或單據上沒有的欄位不得帶猜測值", () => {
  assert.ok(extractionProblems(extraction({ vendor: ok("  ") })).length > 0);
  assert.ok(
    extractionProblems(extraction({ vendor: { status: "UNREADABLE", value: "晴川?" } })).length > 0,
  );
  assert.ok(
    extractionProblems(extraction({ taxId: { status: "NOT_ON_RECEIPT", value: "0" } })).length > 0,
  );
});

test("金額必須是非負、最多兩位小數的數字字串（不接受千分位或幣別符號）", () => {
  assert.deepEqual(extractionProblems(extraction({ totalAmount: ok("1480.5") })), []);
  for (const bad of ["1,480", "NT$1480", "-1", "abc", "1.234"]) {
    assert.ok(extractionProblems(extraction({ totalAmount: ok(bad) })).length > 0, bad);
  }
});

test("日期必須是有效的 YYYY-MM-DD", () => {
  assert.ok(extractionProblems(extraction({ issueDate: ok("2026/09/18") })).length > 0);
  assert.ok(extractionProblems(extraction({ issueDate: ok("2026-02-30") })).length > 0);
});

// ---- 以讀到的金額做 E-01 比對 ---------------------------------------------------

const line = (key: string, amount: string, receiptKeys: string[]) => ({ key, amount, receiptKeys });

test("讀到的金額與申請金額一致", () => {
  const [result] = amountChecksForReading(
    [line("EXP-2026-004", "4200", ["EV-004"])],
    new Map([["EV-004", extraction({ totalAmount: ok("4200") })]]),
  );
  assert.equal(result?.lineKey, "EXP-2026-004");
  assert.equal(result?.result.status, "MATCH");
});

test("讀到的金額與申請金額不一致時，差額有方向且不設容許誤差", () => {
  const [result] = amountChecksForReading(
    [line("EXP-2026-003", "1680", ["EV-003"])],
    new Map([["EV-003", extraction({ totalAmount: ok("1480") })]]),
  );
  assert.equal(result?.result.status, "MISMATCH");
  assert.equal(result?.result.differenceCents, 20000);
});

test("多張憑證對應同一筆明細時先加總", () => {
  const [result] = amountChecksForReading(
    [line("L1", "3000", ["A", "B"])],
    new Map([
      ["A", extraction({ totalAmount: ok("1000.50") })],
      ["B", extraction({ totalAmount: ok("1999.50") })],
    ]),
  );
  assert.equal(result?.result.status, "MATCH");
});

test("金額無法辨識 → 無法判斷，不當成缺憑證或零元", () => {
  const [result] = amountChecksForReading(
    [line("L1", "4200", ["EV-900"])],
    new Map([["EV-900", extraction({ totalAmount: unreadable })]]),
  );
  assert.equal(result?.result.status, "UNDETERMINED");
  assert.match(result?.result.reason ?? "", /EV-900/);
  assert.equal(result?.result.evidenceCents, undefined);
});

test("單據上沒有金額 → 無法判斷", () => {
  const [result] = amountChecksForReading(
    [line("L1", "100", ["A"])],
    new Map([["A", extraction({ totalAmount: absent })]]),
  );
  assert.equal(result?.result.status, "UNDETERMINED");
});

test("幣別不是新台幣或無法確認 → 無法判斷", () => {
  for (const currency of [ok("USD"), unreadable, absent]) {
    const [result] = amountChecksForReading(
      [line("L1", "100", ["A"])],
      new Map([["A", extraction({ totalAmount: ok("100"), currency })]]),
    );
    assert.equal(result?.result.status, "UNDETERMINED", JSON.stringify(currency));
  }
});

test("明細沒有對應憑證 → 缺憑證（多筆費用中缺一份的情境）", () => {
  const results = amountChecksForReading(
    [line("L008-1", "2800", ["EV-008"]), line("L008-2", "480", [])],
    new Map([["EV-008", extraction({ totalAmount: ok("2800") })]]),
  );
  assert.deepEqual(
    results.map((r) => [r.lineKey, r.result.status]),
    [
      ["L008-1", "MATCH"],
      ["L008-2", "MISSING_EVIDENCE"],
    ],
  );
});

test("對應憑證沒有讀取結果 → 無法判斷，不當成缺憑證", () => {
  const [result] = amountChecksForReading([line("L1", "100", ["A"])], new Map());
  assert.equal(result?.result.status, "UNDETERMINED");
});
