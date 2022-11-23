import { EventBus, eventBus } from "@/core/events/EventBus.ts";
import { Logger, logger } from "@/core/logging/Logger.ts";
import { SeedDatabase, seedDatabase } from "@/core/seed/SeedDatabase.ts";
import { SeedLogStorage, seedLogStorage } from "@/core/seed/SeedLogStorage.ts";

export class SeedActions {
  constructor(
    private logger: Logger,
    private seedDatabase: SeedDatabase,
    private seedLogStorage: SeedLogStorage,
    private eventBus: EventBus,
  ) {}

  public async createExecution() {
    const { id } = this.seedDatabase.createExecution();
    await this.seedLogStorage.createExecutionLog({ id });
    this.eventBus.emit("seed-execution-created", { id });
    return { id };
  }

  public startExecution({ id }: { id: number }) {
    this.logger.info(`Starting Seed Execution [${id}]`);
    this.seedDatabase.setExecutionStartDate({ id, startDate: Date.now() });
    this.eventBus.emit("seed-execution-started", { id });
  }

  public endExecution({ id }: { id: number }) {
    this.logger.info(`Ended Seed Execution [${id}]`);
    this.seedDatabase.setExecutionEndDate({ id, endDate: Date.now() });
    this.eventBus.emit("seed-execution-ended", { id });
  }
}

export const seedActions = new SeedActions(
  logger,
  seedDatabase,
  seedLogStorage,
  eventBus,
);
