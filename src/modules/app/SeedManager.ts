import {
  ObjectDatabase,
  objectDatabase,
} from "@/core/storage/ObjectDatabase.ts";
import {
  ConfigProvider,
  configProvider,
} from "@/core/config/ConfigProvider.ts";

export class SeedManager {
  constructor(
    private configProvider: ConfigProvider,
    private objectDatabase: ObjectDatabase,
  ) {}

  public async update() {
    const config = await this.configProvider.getConfig();
    const execution = Date.now();
    const log = await this.objectDatabase.createSeedLog({ execution });
    try {
      try {
        await Deno.remove("./seed", { recursive: true });
      } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) throw e;
      }
      await this.runCommand("git", ["clone", config.seed.repo, "seed"], log);
    } finally {
      log.close();
    }
  }

  private async runCommand(command: string, args: string[], log: Deno.FsFile) {
    const stdoutWriter = new WritableStream<Uint8Array>({
      write(d) {
        log.write(d);
      },
    });
    const stderrWriter = new WritableStream<Uint8Array>({
      write(d) {
        log.write(d);
      },
    });
    const cmd = new Deno.Command(command, {
      args,
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    });
    cmd.spawn();
    await Promise.all([
      cmd.stdout.pipeTo(stdoutWriter),
      cmd.stderr.pipeTo(stderrWriter),
    ]);
    return await cmd.status;
  }
}

export const seedManager = new SeedManager(configProvider, objectDatabase);
