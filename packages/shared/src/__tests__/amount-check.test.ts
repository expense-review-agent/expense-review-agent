// E-01 v1 金額比對（specs/amount-check.md）。移植自 CheckMate 的 amount-check.test.ts。

import { test } from "node:test";
import assert from "node:assert/strict";

import { checkAmount } from "../domain/amount-check.ts";

test("依輸入比對，修改金額會改變結果", () => {
  assert.equal(checkAmount("1480", true, "1480").status, "MATCH");
  const mismatch = checkAmount("1680", true, "1480");
  assert.equal(mismatch.status, "MISMATCH");
  assert.equal(mismatch.differenceCents, 20000);
  // 差額有方向：申請少於憑證為負數
  assert.equal(checkAmount("1000", true, "1050").differenceCents, -5000);
});

test("缺附件與附件金額未填分開", () => {
  assert.equal(checkAmount("2800", false, "").status, "MISSING_EVIDENCE");
  assert.equal(checkAmount("2800", true, "").status, "UNDETERMINED");
});

test("精確比較兩位小數，不使用浮點容差", () => {
  assert.equal(checkAmount("0.30", true, "0.3").status, "MATCH");
  assert.equal(checkAmount("100.01", true, "100.00").differenceCents, 1);
  // 申請零元在數值比對範圍內有效
  assert.equal(checkAmount("0", true, "0").status, "MATCH");
});

for (const value of [
  "",
  "-1",
  "abc",
  "NaN",
  "Infinity",
  "1.001",
  "1e3",
  "9,999",
  "9007199254740992",
]) {
  test(`拒絕無效金額 ${JSON.stringify(value)}`, () => {
    assert.equal(checkAmount(value, true, "100").status, "UNDETERMINED");
    assert.equal(checkAmount("100", true, value).status, "UNDETERMINED");
  });
}

test("結果帶規則版本，供審查紀錄追溯", () => {
  assert.equal(checkAmount("1", true, "1").rule, "E-01 v1");
});
