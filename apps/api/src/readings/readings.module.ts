import { Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { GeminiReceiptReader } from "./gemini-receipt-reader";
import { ReceiptImageStore } from "./receipt-image-store";
import { RECEIPT_READER } from "./receipt-reader";
import { ReadingsController } from "./readings.controller";
import { ReadingsService } from "./readings.service";

@Module({
  controllers: [ReadingsController],
  providers: [
    ReadingsService,
    ReceiptImageStore,
    AuditService,
    // 讀取服務的供應商只在這裡決定；換供應商就換這一行
    { provide: RECEIPT_READER, useClass: GeminiReceiptReader },
  ],
})
export class ReadingsModule {}
