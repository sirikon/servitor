import { dirname, join } from "std/path/mod.ts";
import { ensureDir } from "std/fs/ensure_dir.ts";
import { GlobalState, globalState } from "@/core/state/GlobalState.ts";

type SeedLogIdentifier = {
  id: number;
};

type LogIdentifier = {
  category: string[];
  name: string;
};

export class LogStorage {
  constructor(
    private globalState: GlobalState,
  ) {}

  public async createSeedLog(opts: SeedLogIdentifier) {
    return await this.createLog({
      category: ["seed"],
      name: opts.id.toString(),
    });
  }

  public async readSeedLog(opts: SeedLogIdentifier) {
    const isRunning = this.globalState.isSeedExecutionRunning(opts);
    const { readable, stop } = await this.readLog({
      category: ["seed"],
      name: opts.id.toString(),
      mode: isRunning ? "stream" : "read-full",
    });

    isRunning && (() => {
      const handler = (event: { id: number }) => {
        if (event.id === opts.id) {
          stop();
          this.globalState.eventEmitter.off("seed-execution-ended", handler);
        }
      };
      this.globalState.eventEmitter.on("seed-execution-ended", handler);
    })();

    return readable;
  }

  private async createLog(opts: LogIdentifier) {
    const logPath = this.buildLogPath(opts);
    await ensureDir(dirname(logPath));
    const file = await Deno.open(logPath, {
      createNew: true,
      write: true,
    });
    return file.writable;
  }

  private async readLog(
    opts: LogIdentifier & { mode: "read-full" | "stream" },
  ): Promise<{ readable: ReadableStream<Uint8Array>; stop: () => void }> {
    const logPath = this.buildLogPath(opts);

    if (opts.mode === "read-full") {
      const file = await Deno.open(logPath, { read: true });
      return {
        readable: file.readable,
        stop: () => {},
      };
    } else {
      const command = new Deno.Command("tail", {
        args: ["--follow=name", "--silent", "--lines=+0", logPath],
        stdin: "null",
        stdout: "piped",
        stderr: "null",
      });
      command.spawn();
      return {
        readable: command.stdout,
        stop: () => {
          try {
            command.kill();
          } catch (_) { /**/ }
        },
      };
    }
  }

  private buildLogPath(id: LogIdentifier) {
    return join("logs", ...id.category, `${id.name}.txt`);
  }
}

export const logStorage = new LogStorage(globalState);
