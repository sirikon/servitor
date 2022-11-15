import {
  ObjectDatabase,
  objectDatabase,
} from "@/core/storage/ObjectDatabase.ts";
import {
  ConfigProvider,
  configProvider,
} from "@/core/config/ConfigProvider.ts";
import {
  DockerBuildOpts,
  DockerDriver,
  dockerDriver,
} from "@/core/containers/DockerDriver.ts";

export class SeedManager {
  private textEncoder = new TextEncoder();

  constructor(
    private configProvider: ConfigProvider,
    private objectDatabase: ObjectDatabase,
    private dockerDriver: DockerDriver,
  ) {}

  public async update() {
    const execution = Date.now();
    const config = await this.configProvider.getConfig();
    const log = await this.objectDatabase.createSeedLog({ execution });

    const done = (async () => {
      try {
        try {
          await Deno.remove("./seed", { recursive: true });
        } catch (e) {
          if (!(e instanceof Deno.errors.NotFound)) throw e;
        }

        await log.write(
          this.textEncoder.encode(`=== Cloning ${config.seed.repo}\n`),
        );
        await this.runCommand("git", ["clone", config.seed.repo, "seed"], log);

        await log.write(
          this.textEncoder.encode(`\n=== Building docker image for secrets\n`),
        );
        await this.buildDocker({
          image: `servitor-seed-${execution}`,
          context: "./seed/secrets",
          dockerfile: "./seed/secrets/Dockerfile",
        }, log);
      } finally {
        log.close();
      }
    })();

    return { execution, done };
  }

  private async runCommand(command: string, args: string[], log: Deno.FsFile) {
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
    log: Deno.FsFile,
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

  private buildWritableOutputs(log: Deno.FsFile) {
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

export const seedManager = new SeedManager(
  configProvider,
  objectDatabase,
  dockerDriver,
);
