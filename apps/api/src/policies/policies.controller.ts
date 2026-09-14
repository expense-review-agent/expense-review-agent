import { Controller, Get, Query } from "@nestjs/common";
import { PoliciesService } from "./policies.service";

/** PoliciesController — 掛在 /api/policies。 */
@Controller("policies")
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get()
  list(@Query("category") category?: string) {
    return this.policiesService.list(category);
  }
}
