/* global process, console, AbortController, setTimeout, clearTimeout */
// =============================================================================
// 單據讀取的準確度量測（specs/receipt-reading.md 5.4）
//
// 用示範憑證的已知內容，量測 AI 擷取結果。會實際呼叫 AI 服務並產生費用：
//   pnpm --filter api eval:reading
// 需要 apps/api/.env 的 GEMINI_API_KEY（或環境變數）。
//
// 通過條件：
//   - 7 張示範憑證的總金額全部讀對
//   - EV-900（遮住金額的驗收憑證）的總金額必須是「無法辨識」，不得猜出數字
// 其他欄位逐欄列出結果，供調整讀取指示時參考。
// =============================================================================

import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, "..");
if (existsSync(join(apiRoot, ".env"))) process.loadEnvFile(join(apiRoot, ".env"));

const { GeminiReceiptReader } = require("../dist/readings/gemini-receipt-reader.js");
const { receiptExtractionSchema, extractionProblems } = require("@expense-review-agent/shared");

const FIXTURES = join(apiRoot, "..", "web", "public", "fixtures");
const EVAL = join(apiRoot, "..", "web", "scripts", "fixtures-eval");

// 已知內容：取自 apps/web/public/fixtures/*.svg 上印出的文字
const TRUTH = {
  "EV-001": { vendor: "晴川商旅", totalAmount: "2400", taxId: "RECOGNIZED" },
  "EV-003": { vendor: "城際客運（模擬）", totalAmount: "1480", taxId: "RECOGNIZED" },
  "EV-004": { vendor: "南方旅店", totalAmount: "4200", taxId: "RECOGNIZED" },
  "EV-005": { vendor: "城際鐵路", totalAmount: "1490", taxId: "RECOGNIZED" },
  "EV-006": { vendor: "日常文具", totalAmount: "3600", taxId: "NOT_ON_RECEIPT" },
  "EV-007": { vendor: "創研材料", totalAmount: "1800", taxId: "RECOGNIZED" },
  "EV-008": { vendor: "晴川商旅", totalAmount: "2800", taxId: "RECOGNIZED" },
};

const sameAmount = (a, b) => a !== null && Number(a) === Number(b);
const norm = (s) => (s ?? "").replace(/\s+/g, "");

async function readOne(reader, key, file) {
  const bytes = readFileSync(file);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await reader.read(
      { receiptKey: key, mimeType: "image/png", base64: bytes.toString("base64") },
      controller.signal,
    );
    const parsed = receiptExtractionSchema.safeParse(JSON.parse(response.text));
    if (!parsed.success) return { key, error: "不符合 schema", raw: response.text };
    const problems = extractionProblems(parsed.data);
    if (problems.length) return { key, error: problems.join("；"), raw: response.text };
    return {
      key,
      extraction: parsed.data,
      usage: response.usage,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } catch (error) {
    return { key, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

if (!process.env.GEMINI_API_KEY?.trim()) {
  console.error("尚未設定 GEMINI_API_KEY（apps/api/.env 或環境變數），無法量測。");
  process.exit(1);
}

const reader = new GeminiReceiptReader();
console.log(`模型 ${reader.model}，讀取指示 ${reader.promptVersion}\n`);

let failures = 0;
const totals = { inputTokens: 0, outputTokens: 0, thoughtTokens: 0 };
const addUsage = (u) => u && Object.keys(totals).forEach((k) => (totals[k] += u[k] ?? 0));

for (const [key, truth] of Object.entries(TRUTH)) {
  const r = await readOne(reader, key, join(FIXTURES, `${key}.png`));
  if (r.error) {
    failures++;
    console.log(`✗ ${key} 讀取失敗：${r.error}`);
    continue;
  }
  addUsage(r.usage);
  const e = r.extraction;
  const checks = {
    總金額: sameAmount(e.totalAmount.value, truth.totalAmount),
    供應商: norm(e.vendor.value) === norm(truth.vendor),
    日期: e.issueDate.value === "2026-09-18",
    幣別: e.currency.value === "TWD",
    憑證號碼: norm(e.documentNumber.value).replace("–", "-") === key,
    統編狀態: e.taxId.status === truth.taxId,
  };
  if (!checks.總金額) failures++;
  const detail = Object.entries(checks)
    .map(([k, ok]) => `${ok ? "✓" : "✗"}${k}`)
    .join(" ");
  console.log(
    `${checks.總金額 ? "✓" : "✗"} ${key} ${detail}（讀到金額 ${e.totalAmount.value ?? e.totalAmount.status}）`,
  );
}

const blurred = await readOne(reader, "EV-900", join(EVAL, "EV-900.png"));
if (blurred.error) {
  failures++;
  console.log(`✗ EV-900 讀取失敗：${blurred.error}`);
} else {
  addUsage(blurred.usage);
  const amount = blurred.extraction.totalAmount;
  const ok = amount.status !== "RECOGNIZED";
  if (!ok) failures++;
  console.log(
    `${ok ? "✓" : "✗"} EV-900 遮蔽金額應為無法辨識：實際 ${amount.status}${amount.value ? `（猜出 ${amount.value}）` : ""}`,
  );
}

console.log(
  `\n用量：輸入 ${totals.inputTokens}、輸出 ${totals.outputTokens}、思考 ${totals.thoughtTokens} tokens`,
);
console.log(failures === 0 ? "\n通過" : `\n未通過（${failures} 項）`);
process.exit(failures === 0 ? 0 : 1);
