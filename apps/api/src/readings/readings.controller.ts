import { Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import type { ReadingListResponse, StartReadingResponse } from "@expense-review-agent/shared";
import { ReadingsService } from "./readings.service";

/**
 * 單據讀取（specs/receipt-reading.md）。
 * - POST 建立讀取，立刻回 202；讀取在背景進行
 * - GET 取得讀取紀錄（由新到舊），前端輪詢直到最新一筆不是 RUNNING
 */
@Controller("cases")
export class ReadingsController {
  constructor(private readonly readings: ReadingsService) {}

  @Post(":caseNumber/readings")
  @HttpCode(202)
  start(@Param("caseNumber") caseNumber: string): Promise<StartReadingResponse> {
    return this.readings.start(caseNumber);
  }

  @Get(":caseNumber/readings")
  list(@Param("caseNumber") caseNumber: string): Promise<ReadingListResponse> {
    return this.readings.list(caseNumber);
  }
}
