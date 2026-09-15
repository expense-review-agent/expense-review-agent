// 金額顯示格式化測試——字串進、字串出，不經 JS number。

import { test } from "node:test";
import assert from "node:assert/strict";

import { formatMoney } from "../presentation/money.ts";

test("formats TWD with NT$ and thousands separators, keeping decimals verbatim", () => {
  assert.equal(formatMoney("12345.50", "TWD"), "NT$ 12,345.50");
  assert.equal(formatMoney("800", "TWD"), "NT$ 800");
  assert.equal(formatMoney("1234567", "TWD"), "NT$ 1,234,567");
});

test("non-TWD shows the currency code and never converts", () => {
  assert.equal(formatMoney("12000", "USD"), "USD 12,000");
});

test("null amount renders as a dash", () => {
  assert.equal(formatMoney(null, "TWD"), "—");
});

test("does not lose precision beyond JS number range", () => {
  assert.equal(formatMoney("90071992547409930.01", "TWD"), "NT$ 90,071,992,547,409,930.01");
});

test("unexpected format is shown as-is", () => {
  assert.equal(formatMoney("abc", "TWD"), "NT$ abc");
  assert.equal(formatMoney("-300", "TWD"), "NT$ -300");
});
