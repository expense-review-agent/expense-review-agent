import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { Injectable } from "@nestjs/common";
import type { ReceiptImage } from "./receipt-reader";

/**
 * 讀取模擬憑證圖檔。圖檔放在前端的 public 目錄（畫面顯示與 AI 讀取用同一張 PNG），
 * 預設為 apps/web/public；可用 RECEIPT_IMAGE_ROOT 覆寫。
 */
@Injectable()
export class ReceiptImageStore {
  private readonly root = resolve(
    process.env.RECEIPT_IMAGE_ROOT?.trim() || resolve(process.cwd(), "..", "web", "public"),
  );

  async load(
    receiptKey: string,
    imagePath: string,
  ): Promise<{ image: ReceiptImage; sha256: string }> {
    if (!imagePath.toLowerCase().endsWith(".png")) {
      throw new Error(`憑證 ${receiptKey} 的圖檔不是 PNG：${imagePath}`);
    }
    const file = resolve(this.root, `.${imagePath.startsWith("/") ? "" : "/"}${imagePath}`);
    // imagePath 來自資料庫，仍確認不會讀到 root 以外的檔案
    if (!file.startsWith(this.root + sep)) {
      throw new Error(`憑證 ${receiptKey} 的圖檔路徑不合法：${imagePath}`);
    }
    const bytes = await readFile(file);
    return {
      image: { receiptKey, mimeType: "image/png", base64: bytes.toString("base64") },
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
}
