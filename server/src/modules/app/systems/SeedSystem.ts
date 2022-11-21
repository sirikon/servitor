import {
  ConfigProvider,
  configProvider,
} from "@/core/config/ConfigProvider.ts";
import {
  DockerBuildOpts,
  DockerDriver,
  dockerDriver,
} from "@/core/containers/DockerDriver.ts";
import { GlobalState, globalState } from "@/core/state/GlobalState.ts";
import { LogStorage, logStorage } from "@/core/storage/LogStorage.ts";
import {
  RelationalDatabase,
  relationalDatabase,
} from "@/core/storage/RelationalDatabase.ts";

export class SeedSystem {
  private textEncoder = new TextEncoder();

  constructor(
    private globalState: GlobalState,
    private configProvider: ConfigProvider,
    private logStorage: LogStorage,
    private relationalDatabase: RelationalDatabase,
    private dockerDriver: DockerDriver,
  ) {}

  public async execute() {
    const id = this.relationalDatabase.insertSeedExecution();
    const config = await this.configProvider.getConfig();
    const log = await this.logStorage.createSeedLog({ id });
    const logWriter = log.getWriter();

    const done = (async () => {
      try {
        this.globalState.setSeedExecutionRunningState({
          id,
          running: true,
        });

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
      } finally {
        this.globalState.setSeedExecutionRunningState({
          id,
          running: false,
        });
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
  globalState,
  configProvider,
  logStorage,
  relationalDatabase,
  dockerDriver,
);
