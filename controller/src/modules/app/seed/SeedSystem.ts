import { Mutex } from "async-mutex";
import { configProvider } from "@/core/config/ConfigProvider.ts";
import { seedLogStorage } from "@/core/seed/SeedLogStorage.ts";
import { dockerDriver } from "@/infrastructure/DockerDriver.ts";
import { logger } from "@/infrastructure/Logger.ts";
import { SeedRunner } from "@/app/seed/SeedRunner.ts";
import { SeedStore } from "@/core/seed/SeedStore.ts";
import { seedStore } from "@/core/seed/SeedStore.ts";
import { seedActions } from "@/core/seed/SeedActions.ts";

export class SeedSystem {
  private executionMutex = new Mutex();

  constructor(
    private seedStore: SeedStore,
  ) {}

  public start() {
    this.seedStore.events.on("execution-updated", ({ execution }) => {
      if (execution.status === "scheduled") {
        this.runExecution(execution);
      }
    });
  }

  private async runExecution(execution: { id: number }) {
    try {
      await this.executionMutex.runExclusive(async () => {
        const runner = new SeedRunner(
          execution,
          logger,
          configProvider,
          seedActions,
          seedLogStorage,
          dockerDriver,
        );
        await runner.execute();
      });
    } catch (_: unknown) { /**/ }
  }
}

export const seedSystem = new SeedSystem(seedStore);
