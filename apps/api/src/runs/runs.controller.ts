import { Controller, Post, Get, Param, HttpCode } from "@nestjs/common";
import { RunsService } from "./runs.service";

/**
 * 兩組路由：
 * - POST /api/cases/:id/runs（建立 run，回 202）
 * - GET  /api/runs/:runId（查狀態）
 * 因為前綴不同，用兩個 controller class 較清楚。
 */
@Controller("cases")
export class CaseRunsController {
  constructor(private readonly runsService: RunsService) {}

  @Post(":id/runs")
  @HttpCode(202) // 非同步契約：回 202 Accepted
  create(@Param("id") id: string) {
    return this.runsService.create(id);
  }
}

@Controller("runs")
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Get(":runId")
  state(@Param("runId") runId: string) {
    return this.runsService.state(runId);
  }
}
