import {
  ConfigProvider,
  configProvider,
} from "@/core/config/ConfigProvider.ts";
import {
  DockerBuildOpts,
  DockerDriver,
  dockerDriver,
} from "@/core/containers/DockerDriver.ts";
import { LogStorage, logStorage } from "@/core/storage/LogStorage.ts";
import { EventBus, eventBus } from "@/core/events/EventBus.ts";
import { Database, database } from "@/core/storage/Database.ts";
import { Logger, logger } from "../../core/logging/Logger.ts";

export class SeedSystem {
  private textEncoder = new TextEncoder();

  constructor(
    private logger: Logger,
    private eventBus: EventBus,
    private configProvider: ConfigProvider,
    private logStorage: LogStorage,
    private database: Database,
    private dockerDriver: DockerDriver,
  ) {}

  public async execute() {
    const id = this.database.insertSeedExecution();
    const config = await this.configProvider.getConfig();
    const log = await this.logStorage.createSeedLog({ id });
    const logWriter = log.getWriter();

    const done = (async () => {
      try {
        this.logger.info(`Starting seed ${id}`);
        this.database.setSeedExecutionStartDate({ id, start_date: Date.now() });
        this.eventBus.emit("seed-execution-started", { id });

        try {
          await Deno.remove("./seed", { recursive: true });
        } catch (e) {
          if (!(e instanceof Deno.errors.NotFound)) throw e;
        }

        await logWriter.write(
          this.textEncoder.encode(`=== Cloning ${config.seed.repo}\n`),
        );
        await this.runCommand(
          "git",
          ["clone", config.seed.repo, "seed"],
          logWriter,
        );

        await logWriter.write(
          this.textEncoder.encode(`\n=== Building docker image for secrets\n`),
        );
        await this.buildDocker({
          image: `servitor-seed-${id}`,
          context: "./seed/secrets",
          dockerfile: "./seed/secrets/Dockerfile",
        }, logWriter);
      } catch (e: unknown) {
        this.logger.error(
          `Error while running seed ${id}: ${
            e instanceof Error ? e.message : "" + e
          }`,
        );
        throw e;
      } finally {
        this.logger.info("Seed execution ended " + id);
        this.database.setSeedExecutionEndDate({ id, end_date: Date.now() });
        this.eventBus.emit("seed-execution-ended", { id });
        await logWriter.close();
      }
    })();

    return { id, done };
  }

  private async runCommand(
    command: string,
    args: string[],
    log: WritableStreamDefaultWriter<Uint8Array>,
  ) {
    const { stdout, stderr } = this.buildWritableOutputs(log);
    const cmd = new Deno.Command(command, {
      args,
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    });
    cmd.spawn();
    await Promise.all([
      cmd.stdout.pipeTo(stdout),
      cmd.stderr.pipeTo(stderr),
    ]);
    return await cmd.status;
  }

  private async buildDocker(
    { image, context, dockerfile }: Pick<
      DockerBuildOpts,
      "image" | "dockerfile" | "context"
    >,
    log: WritableStreamDefaultWriter<Uint8Array>,
  ) {
    const { stdout, stderr } = this.buildWritableOutputs(log);
    await this.dockerDriver.build({
      image,
      context,
      dockerfile,
      stdout,
      stderr,
    });
  }

  private buildWritableOutputs(log: WritableStreamDefaultWriter<Uint8Array>) {
    const stdout = new WritableStream<Uint8Array>({
      write(d) {
        log.write(d);
      },
    });
    const stderr = new WritableStream<Uint8Array>({
      write(d) {
        log.write(d);
      },
    });
    return { stdout, stderr };
  }
}

export const seedSystem = new SeedSystem(
  logger,
  eventBus,
  configProvider,
  logStorage,
  database,
  dockerDriver,
);
