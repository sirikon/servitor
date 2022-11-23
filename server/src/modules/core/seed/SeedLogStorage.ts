import { LogStorage, logStorage } from "@/infrastructure/LogStorage.ts";
import { EventBus, eventBus } from "@/core/events/EventBus.ts";
import { SeedDatabase, seedDatabase } from "@/core/seed/SeedDatabase.ts";

const LOG_CATEGORY = ["seed"];

export class SeedLogStorage {
  constructor(
    private seedDatabase: SeedDatabase,
    private logStorage: LogStorage,
    private eventBus: EventBus,
  ) {}

  public async createExecutionLog(opts: { id: number }) {
    await this.logStorage.createLog({
      category: LOG_CATEGORY,
      name: opts.id.toString(),
    });
  }

  public async writeExecutionLog(opts: { id: number }) {
    return await this.logStorage.writeLog({
      category: LOG_CATEGORY,
      name: opts.id.toString(),
    });
  }

  public async readExecutionLog(opts: { id: number }) {
    const isRunning = this.isExecutionRunning(opts);
    const { readable, stop } = await this.logStorage.readLog({
      category: ["seed"],
      name: opts.id.toString(),
      mode: isRunning ? "tail" : "read-full",
    });

    isRunning && (() => {
      const handler = (event: { id: number }) => {
        if (event.id !== opts.id) return;
        stop();
        this.eventBus.off("seed-execution-ended", handler);
      };
      this.eventBus.on("seed-execution-ended", handler);
    })();

    return readable;
  }

  private isExecutionRunning(opts: { id: number }) {
    const seedExecution = this.seedDatabase.getExecution(opts);
    if (!seedExecution) return false;

    return seedExecution.startDate != null && seedExecution.endDate == null;
  }
}

export const seedLogStorage = new SeedLogStorage(
  seedDatabase,
  logStorage,
  eventBus,
);
