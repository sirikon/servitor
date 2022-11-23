import {
  ConfigProvider,
  configProvider,
} from "@/core/config/ConfigProvider.ts";
import { Logger, logger } from "@/core/logging/Logger.ts";
import { SeedLogStorage, seedLogStorage } from "@/core/seed/SeedLogStorage.ts";
import {
  DockerBuildOpts,
  DockerDriver,
  dockerDriver,
} from "@/infrastructure/DockerDriver.ts";
import { SeedActions, seedActions } from "@/core/seed/SeedActions.ts";

export class SeedRunner {
  private textEncoder = new TextEncoder();

  constructor(
    private logger: Logger,
    private configProvider: ConfigProvider,
    private seedActions: SeedActions,
    private seedLogStorage: SeedLogStorage,
    private dockerDriver: DockerDriver,
  ) {}

  public async execute() {
    const config = await this.configProvider.getConfig();
    const { id } = await this.seedActions.createExecution();

    const done = (async () => {
      const log = await this.seedLogStorage.writeExecutionLog({ id })
        .then((l) => l.getWriter());

      const logLine = (text: string) =>
        log.write(this.textEncoder.encode(`=== ${text}\n`));

      try {
        this.seedActions.startExecution({ id });

        try {
          await Deno.remove("./seed", { recursive: true });
        } catch (e) {
          if (!(e instanceof Deno.errors.NotFound)) throw e;
        }

        await logLine(`Cloning ${config.seed.repo}`);
        await this.runCommand(
          "git",
          ["clone", config.seed.repo, "seed"],
          log,
        );

        await logLine("Building docker image for secrets");
        await this.buildDocker({
          image: `servitor-seed-${id}`,
          context: "./seed/secrets",
          dockerfile: "./seed/secrets/Dockerfile",
        }, log);
      } catch (e: unknown) {
        this.logger.error(
          `Error while running seed ${id}: ${
            e instanceof Error ? e.message : "" + e
          }`,
        );
        throw e;
      } finally {
        this.seedActions.endExecution({ id });
        await log.close();
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

export const seedRunner = new SeedRunner(
  logger,
  configProvider,
  seedActions,
  seedLogStorage,
  dockerDriver,
);
