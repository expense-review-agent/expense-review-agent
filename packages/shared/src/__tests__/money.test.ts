// 金額顯示與加總：以字串與最小貨幣單位處理，不經 JS number 的浮點運算。

import { test } from "node:test";
import assert from "node:assert/strict";

import { formatCentsTwd, formatTwd, sumAmounts } from "../presentation/money.ts";

test("整數金額加上千分位，不顯示小數", () => {
  assert.equal(formatTwd("1480"), "NT$1,480");
  assert.equal(formatTwd("1480.00"), "NT$1,480");
  assert.equal(formatTwd("0"), "NT$0");
});

test("有角分時顯示兩位小數", () => {
  assert.equal(formatTwd("1480.5"), "NT$1,480.50");
  assert.equal(formatTwd("1234567.05"), "NT$1,234,567.05");
});

test("無法解析的金額原樣顯示，不猜測", () => {
  assert.equal(formatTwd("abc"), "abc");
});

test("加總以最小貨幣單位計算，沒有浮點誤差", () => {
  assert.equal(sumAmounts(["0.1", "0.2"]), "0.30");
  assert.equal(sumAmounts(["2400", "2800", "480"]), "5680.00");
  assert.equal(sumAmounts([]), "0.00");
});

test("加總遇到無法解析的金額時丟出錯誤，不略過", () => {
  assert.throws(() => sumAmounts(["100", "x"]));
});

test("以分為單位的金額顯示（E-01 的申請額、憑證額、差額）", () => {
  assert.equal(formatCentsTwd(148000), "NT$1,480");
  assert.equal(formatCentsTwd(5), "NT$0.05");
  // 差額取絕對值顯示，方向由呼叫端的文字說明
  assert.equal(formatCentsTwd(-20000), "NT$200");
});
