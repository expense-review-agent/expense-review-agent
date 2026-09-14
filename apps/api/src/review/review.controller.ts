import { Controller, Post, Get, Param, Body } from "@nestjs/common";
import { ReviewService } from "./review.service";
import type { DispositionRequest, SupervisorReviewRequest } from "@expense-review-agent/shared";

/** ReviewController — 人工動作與稽核，掛在 /api/cases。 */
@Controller("cases")
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post(":id/disposition")
  disposition(@Param("id") id: string, @Body() body: DispositionRequest) {
    return this.reviewService.disposition(id, body);
  }

  @Post(":id/supervisor-review")
  supervisorReview(@Param("id") id: string, @Body() body: SupervisorReviewRequest) {
    return this.reviewService.supervisorReview(id, body);
  }

  @Get(":id/audit")
  audit(@Param("id") id: string) {
    return this.reviewService.audit(id);
  }
}
