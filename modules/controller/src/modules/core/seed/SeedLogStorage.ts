import { LogStorage, logStorage } from "@/infrastructure/LogStorage.ts";
import { SeedExecution, SeedStore, seedStore } from "@/core/seed/SeedStore.ts";

const LOG_CATEGORY = ["seed"];

export class SeedLogStorage {
  constructor(
    private seedStore: SeedStore,
    private logStorage: LogStorage,
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
      const handler = ({ execution }: { execution: SeedExecution }) => {
        if (execution.id === opts.id && execution.endDate != null) {
          stop();
          this.seedStore.events.off("execution-updated", handler);
        }
      };
      this.seedStore.events.on("execution-updated", handler);
    })();

    return readable;
  }

  private isExecutionRunning(opts: { id: number }) {
    const seedExecution = this.seedStore.getExecution(opts);
    if (!seedExecution) return false;

    return seedExecution.startDate != null && seedExecution.endDate == null;
  }
}

export const seedLogStorage = new SeedLogStorage(
  seedStore,
  logStorage,
);
