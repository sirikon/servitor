import { configProvider } from "@/core/config/ConfigProvider.ts";
import { SeedActions, seedActions } from "@/core/seed/SeedActions.ts";
import { seedLogStorage } from "@/core/seed/SeedLogStorage.ts";
import { dockerDriver } from "@/infrastructure/DockerDriver.ts";
import { logger } from "@/infrastructure/Logger.ts";
import { SeedRunner } from "@/app/seed/SeedRunner.ts";

export class SeedSystem {
  constructor(
    private seedActions: SeedActions,
  ) {}

  public async execute() {
    const { id } = await this.seedActions.createExecution();
    this.runExecution({ id });
    return { id };
  }

  private async runExecution(execution: { id: number }) {
    try {
      const runner = new SeedRunner(
        execution,
        logger,
        configProvider,
        seedActions,
        seedLogStorage,
        dockerDriver,
      );
      await runner.execute();
    } catch (_: unknown) { /**/ }
  }
}

export const seedSystem = new SeedSystem(seedActions);
