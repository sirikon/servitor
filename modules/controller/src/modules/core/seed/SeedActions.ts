import { singleton } from "tsyringe";
import { SeedStore } from "@/core/seed/SeedStore.ts";
import { SeedLogStorage } from "@/core/seed/SeedLogStorage.ts";
import { Logger } from "denox/logging/Logger.ts";

@singleton()
export class SeedActions {
  constructor(
    private logger: Logger,
    private seedStore: SeedStore,
    private seedLogStorage: SeedLogStorage,
  ) {}

  public async createExecution() {
    const { id } = this.seedStore.createExecution();
    await this.seedLogStorage.createExecutionLog({ id });
    this.seedStore.scheduleExecution({ id });
    return { id };
  }

  public startExecution({ id }: { id: number }) {
    this.logger.info(`Starting Seed Execution [${id}]`);
    this.seedStore.startExecution({ id, startDate: Date.now() });
  }

  public endExecution({ id }: { id: number }) {
    this.logger.info(`Ended Seed Execution [${id}]`);
    this.seedStore.endExecution({ id, endDate: Date.now() });
  }
}
