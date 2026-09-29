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
const { ReaderUnavailableError } = require("../dist/readings/receipt-reader.js");
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

// 免費方案有每日額度，每次請求（含失敗）都算次數，所以最多只試 2 次
const ATTEMPTS = 2;
// EVAL_FAST 只用來以本機假服務驗證重試邏輯，實際量測不要設定
const BACKOFF_MS = process.env.EVAL_FAST ? [10] : [15_000];

async function attempt(reader, key, bytes) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    return await reader.read(
      { receiptKey: key, mimeType: "image/png", base64: bytes.toString("base64") },
      controller.signal,
    );
  } catch (error) {
    // 自己的 60 秒逾時中止，視同服務忙碌
    if (controller.signal.aborted) {
      throw new ReaderUnavailableError("busy", "超過 60 秒沒有回應");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readOne(reader, key, file) {
  const bytes = readFileSync(file);
  for (let i = 1; i <= ATTEMPTS; i++) {
    let response;
    try {
      response = await attempt(reader, key, bytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!(error instanceof ReaderUnavailableError)) return { key, error: message };
      // 今日額度用完：再試只會繼續失敗，整批停止
      if (error.kind === "daily_quota") return { key, quotaExhausted: message };
      if (i === ATTEMPTS) return { key, unavailable: message };
      console.log(
        `  … ${key} 第 ${i} 次：服務暫時無法使用，${BACKOFF_MS[i - 1] / 1000} 秒後重試（${message.slice(0, 60)}）`,
      );
      await new Promise((r) => setTimeout(r, BACKOFF_MS[i - 1]));
      continue;
    }
    let json;
    try {
      json = JSON.parse(response.text);
    } catch {
      return { key, error: "回應不是 JSON", raw: response.text };
    }
    const parsed = receiptExtractionSchema.safeParse(json);
    if (!parsed.success) return { key, error: "不符合 schema", raw: response.text };
    const problems = extractionProblems(parsed.data);
    if (problems.length) return { key, error: problems.join("；"), raw: response.text };
    return {
      key,
      extraction: parsed.data,
      usage: response.usage,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
}

if (!process.env.GEMINI_API_KEY?.trim()) {
  console.error("尚未設定 GEMINI_API_KEY（apps/api/.env 或環境變數），無法量測。");
  process.exit(1);
}

const reader = new GeminiReceiptReader();
console.log(`模型 ${reader.model}，讀取指示 ${reader.promptVersion}\n`);

let failures = 0;
let unavailable = 0;
const totals = { inputTokens: 0, outputTokens: 0, thoughtTokens: 0 };
const addUsage = (u) => u && Object.keys(totals).forEach((k) => (totals[k] += u[k] ?? 0));

for (const [key, truth] of Object.entries(TRUTH)) {
  const r = await readOne(reader, key, join(FIXTURES, `${key}.png`));
  if (r.quotaExhausted) {
    console.log(`\n■ 停止量測：${r.quotaExhausted}`);
    console.log(`  已量測的結果如上；未量測的憑證請等額度恢復後重跑。`);
    process.exit(3);
  }
  if (r.unavailable) {
    unavailable++;
    console.log(`? ${key} 無法量測（服務暫時無法使用，已重試 ${ATTEMPTS} 次）：${r.unavailable}`);
    continue;
  }
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
  const FIELD_OF = {
    總金額: "totalAmount",
    供應商: "vendor",
    日期: "issueDate",
    幣別: "currency",
    憑證號碼: "documentNumber",
    統編狀態: "taxId",
  };
  // 錯的欄位印出模型實際讀到的狀態與值，才能判斷該改讀取指示還是驗收標準
  const misses = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => {
      const f = e[FIELD_OF[k]];
      return `${k}＝${f.status}${f.value === null ? "" : `「${f.value}」`}`;
    });
  if (!checks.總金額) failures++;
  const detail = Object.entries(checks)
    .map(([k, ok]) => `${ok ? "✓" : "✗"}${k}`)
    .join(" ");
  console.log(
    `${checks.總金額 ? "✓" : "✗"} ${key} ${detail}（讀到金額 ${e.totalAmount.value ?? e.totalAmount.status}）`,
  );
  if (misses.length) console.log(`    實際讀到：${misses.join("；")}`);
}

const blurred = await readOne(reader, "EV-900", join(EVAL, "EV-900.png"));
if (blurred.quotaExhausted) {
  console.log(`\n■ 停止量測：${blurred.quotaExhausted}`);
  process.exit(3);
}
if (blurred.unavailable) {
  unavailable++;
  console.log(`? EV-900 無法量測（服務暫時無法使用）：${blurred.unavailable}`);
} else if (blurred.error) {
  failures++;
  console.log(`✗ EV-900 讀取失敗：${blurred.error}`);
} else {
  addUsage(blurred.usage);
  const amount = blurred.extraction.totalAmount;
  // 金額被遮住：憑證上應該有金額，所以必須是「無法辨識」，不是「單據上沒有此欄位」
  const ok = amount.status === "UNREADABLE";
  if (!ok) failures++;
  console.log(
    `${ok ? "✓" : "✗"} EV-900 遮蔽金額應為無法辨識：實際 ${amount.status}${amount.value ? `（猜出 ${amount.value}）` : ""}`,
  );
}

console.log(
  `\n用量：輸入 ${totals.inputTokens}、輸出 ${totals.outputTokens}、思考 ${totals.thoughtTokens} tokens`,
);
if (failures > 0) {
  console.log(
    `\n未通過：${failures} 項讀錯或格式不合${unavailable ? `；另有 ${unavailable} 張無法量測` : ""}`,
  );
  process.exit(1);
}
if (unavailable > 0) {
  console.log(
    `\n尚無結論：已量測的都正確，但 ${unavailable} 張因服務暫時無法使用而無法量測，請稍後重跑`,
  );
  process.exit(2);
}
console.log("\n通過");
process.exit(0);
