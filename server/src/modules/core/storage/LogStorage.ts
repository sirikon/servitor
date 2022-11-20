import { dirname, join } from "std/path/mod.ts";
import { ensureDir } from "std/fs/ensure_dir.ts";
import { GlobalState, globalState } from "@/core/state/GlobalState.ts";

export type FollowSeedLogResult = {
  output: ReadableStream<Uint8Array>;
};

export type LogIdentifier = {
  category: string[];
  name: string;
};

export class LogStorage {
  constructor(
    private globalState: GlobalState,
  ) {}

  public async createLog(id: LogIdentifier) {
    const logPath = this.buildLogPath(id);
    await ensureDir(dirname(logPath));
    const file = await Deno.open(logPath, {
      createNew: true,
      write: true,
    });
    return file.writable;
  }

  private buildLogPath(id: LogIdentifier) {
    return join("logs", ...id.category, `${id.name}.txt`);
  }

  public async createSeedLog(opts: { execution: number }) {
    const logPath = `seed-logs/${opts.execution}.txt`;

    return await Deno.open(logPath, {
      createNew: true,
      write: true,
    });
  }

  public async followSeedLog(
    opts: { execution: number },
  ): Promise<FollowSeedLogResult> {
    const logPath = `seed-logs/${opts.execution}.txt`;
    const isRunning = this.globalState.isSeedExecutionRunning(opts);

    if (!isRunning) {
      const file = await Deno.open(logPath, { read: true });
      return {
        output: file.readable,
      };
    }

    const command = new Deno.Command("tail", {
      args: ["--follow=name", "--silent", "--lines=+0", logPath],
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    });
    command.spawn();

    (async () => {
      const handler = (event: { execution: number }) => {
        event.execution === opts.execution && command.kill();
      };
      this.globalState.eventEmitter.on("seed-execution-ended", handler);
      await command.status;
      this.globalState.eventEmitter.off("seed-execution-ended", handler);
    })();

    return {
      output: command.stdout,
    };
  }
}

export const objectDatabase = new LogStorage(globalState);
