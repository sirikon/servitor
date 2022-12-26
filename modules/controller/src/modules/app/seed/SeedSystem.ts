import { container, singleton } from "tsyringe";
import { Mutex } from "async-mutex";
import { ConfigProvider } from "@/core/config/ConfigProvider.ts";
import { SeedLogStorage } from "@/core/seed/SeedLogStorage.ts";
import { DockerDriver } from "@/infrastructure/DockerDriver.ts";
import { SeedRunner } from "@/app/seed/SeedRunner.ts";
import { SeedStore } from "@/core/seed/SeedStore.ts";
import { SeedActions } from "@/core/seed/SeedActions.ts";
import { Logger } from "denox/logging/Logger.ts";

@singleton()
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
          container.resolve(Logger),
          container.resolve(ConfigProvider),
          container.resolve(SeedActions),
          container.resolve(SeedLogStorage),
          container.resolve(DockerDriver),
        );
        await runner.execute();
      });
    } catch (_: unknown) { /**/ }
  }
}
