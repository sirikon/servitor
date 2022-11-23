import { Logger, logger } from "@/infrastructure/Logger.ts";
import { SeedStore, seedStore } from "@/core/seed/SeedStore.ts";
import { SeedLogStorage, seedLogStorage } from "@/core/seed/SeedLogStorage.ts";

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

export const seedActions = new SeedActions(
  logger,
  seedStore,
  seedLogStorage,
);
