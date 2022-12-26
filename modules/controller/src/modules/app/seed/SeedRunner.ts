import { ConfigProvider } from "@/core/config/ConfigProvider.ts";
import { Logger } from "@/infrastructure/Logger.ts";
import { SeedLogStorage } from "@/core/seed/SeedLogStorage.ts";
import {
  DockerBuildOpts,
  DockerDriver,
} from "@/infrastructure/DockerDriver.ts";
import { SeedActions } from "@/core/seed/SeedActions.ts";

export class SeedRunner {
  private textEncoder = new TextEncoder();
  private writer: Promise<WritableStreamDefaultWriter<Uint8Array>>;

  constructor(
    private execution: { id: number },
    private logger: Logger,
    private configProvider: ConfigProvider,
    private seedActions: SeedActions,
    private seedLogStorage: SeedLogStorage,
    private dockerDriver: DockerDriver,
  ) {
    this.writer = this.seedLogStorage.writeExecutionLog(this.execution)
      .then((l) => l.getWriter());
  }

  public async execute() {
    try {
      const config = await this.configProvider.getConfig();
      this.seedActions.startExecution(this.execution);

      await this.writeLogLine("Removing existing seed folder");
      await this.removeSeedFolder();

      await this.writeLogLine(`Cloning ${config.seed.repo}`);
      await this.runCommand("git", ["clone", config.seed.repo, "seed"]);

      await this.writeLogLine("Building docker image for secrets");
      await this.buildDocker({
        image: `servitor-seed-${this.execution.id}`,
        context: "./seed/secrets",
        dockerfile: "./seed/secrets/Dockerfile",
      });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "" + e;
      this.logger.error(
        `Error while running seed ${this.execution.id}: ${errorMessage}`,
      );
      throw e;
    } finally {
      this.seedActions.endExecution(this.execution);
      await this.closeLog();
    }
  }

  private async runCommand(
    command: string,
    args: string[],
  ) {
    const { stdout, stderr } = await this.buildWritableOutputs();
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
  ) {
    const { stdout, stderr } = await this.buildWritableOutputs();
    await this.dockerDriver.build({
      image,
      context,
      dockerfile,
      stdout,
      stderr,
    });
  }

  private async buildWritableOutputs() {
    const log = await this.writer;
    const stdout = new WritableStream<Uint8Array>({
      async write(d) {
        await log.write(d);
      },
    });
    const stderr = new WritableStream<Uint8Array>({
      async write(d) {
        await log.write(d);
      },
    });
    return { stdout, stderr };
  }

  private async removeSeedFolder() {
    try {
      await Deno.remove("./seed", { recursive: true });
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
  }

  private async writeLogLine(text: string) {
    (await this.writer).write(this.textEncoder.encode(`=== ${text}\n`));
  }

  private async closeLog() {
    (await this.writer).close();
  }
}
