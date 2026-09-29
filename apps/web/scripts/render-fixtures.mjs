/* global process, console, fetch, setTimeout, WebSocket, Buffer */
// 把 public/fixtures/*.svg 的模擬憑證渲染成 PNG（2 倍解析度）。
//
// 為什麼需要：AI 讀取服務只接受點陣圖（PNG/JPEG/WebP），不接受 SVG。
// 畫面顯示與 AI 讀取都使用同一張 PNG，確保「使用者看到的」就是「AI 讀到的」。
//
// 需要本機的 Google Chrome，不增加套件相依：
//   node apps/web/scripts/render-fixtures.mjs
// 另外產生一張只供驗收用的遮蔽金額憑證（scripts/fixtures-eval/EV-900.png），
// 對應 specs/receipt-reading.md 4.2 / 4.6，不放進示範案件。

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, "..", "public", "fixtures");
const evalDir = join(here, "fixtures-eval");
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const SCALE = 2;

const profile = mkdtempSync(join(tmpdir(), "render-fixtures-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function devtoolsPage() {
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await (await fetch(`http://localhost:${PORT}/json`)).json();
      const page = targets.find((t) => t.type === "page");
      if (page) return page;
    } catch {
      /* Chrome 尚未啟動 */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("無法連線到 headless Chrome");
}

const page = await devtoolsPage();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const waiting = new Map();
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  waiting.get(msg.id)?.(msg);
});
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    waiting.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

async function render(url, width, height, out) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: SCALE,
    mobile: false,
  });
  await send("Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 400));
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  console.log(`已產生 ${out}`);
}

function sizeOf(svg) {
  const m = /width="(\d+)" height="(\d+)"/.exec(svg);
  if (!m) throw new Error("SVG 缺少 width/height");
  return { width: Number(m[1]), height: Number(m[2]) };
}

await send("Page.enable");
try {
  for (const file of readdirSync(fixtures)
    .filter((f) => f.endsWith(".svg"))
    .sort()) {
    const svgPath = join(fixtures, file);
    const { width, height } = sizeOf(readFileSync(svgPath, "utf8"));
    await render(pathToFileURL(svgPath).href, width, height, svgPath.replace(/\.svg$/, ".png"));
  }

  // 驗收用：以 EV-004 為底，模糊整張並遮住合計金額，模擬「金額無法辨識」。
  mkdirSync(evalDir, { recursive: true });
  const base = join(fixtures, "EV-004.svg");
  const { width, height } = sizeOf(readFileSync(base, "utf8"));
  const html = join(profile, "ev-900.html");
  writeFileSync(
    html,
    `<!doctype html><html style="overflow:hidden"><body style="margin:0;overflow:hidden">
<div style="position:relative;width:${width}px;height:${height}px">
  <img src="${pathToFileURL(base).href}" style="width:100%;height:100%;filter:blur(2.2px)">
  <div style="position:absolute;left:0;right:0;bottom:0;height:42%;background:#8a8f96"></div>
</div></body></html>`,
  );
  await render(pathToFileURL(html).href, width, height, join(evalDir, "EV-900.png"));
} finally {
  ws.close();
  // 等 Chrome 真正結束再刪暫存 profile，否則它還在寫檔會導致刪除失敗
  const exited = new Promise((r) => chrome.once("exit", r));
  chrome.kill();
  await exited;
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
