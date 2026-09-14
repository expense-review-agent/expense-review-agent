import { Module } from "@nestjs/common";
import { CaseRunsController, RunsController } from "./runs.controller";
import { RunsService } from "./runs.service";

@Module({
  controllers: [CaseRunsController, RunsController],
  providers: [RunsService],
})
export class RunsModule {}
