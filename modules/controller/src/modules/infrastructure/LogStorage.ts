import { dirname, join } from "std/path/mod.ts";
import { ensureDir } from "std/fs/ensure_dir.ts";

export type LogIdentifier = {
  category: string[];
  name: string;
};

export type CreateLogOpts = LogIdentifier;
export type ReadLogOpts = LogIdentifier & {
  mode: "read-full" | "tail";
};
export type ReadLogsResult = {
  readable: ReadableStream<Uint8Array>;
  stop: () => void;
};

export class LogStorage {
  constructor() {}

  public async createLog(opts: LogIdentifier) {
    const logPath = this.buildLogPath(opts);
    await ensureDir(dirname(logPath));
    await Deno.writeFile(logPath, new Uint8Array());
  }

  public async writeLog(opts: LogIdentifier) {
    const logPath = this.buildLogPath(opts);
    const file = await Deno.open(logPath, {
      write: true,
    });
    return file.writable;
  }

  public async readLog(opts: ReadLogOpts): Promise<ReadLogsResult> {
    const logPath = this.buildLogPath(opts);

    if (opts.mode === "read-full") {
      const file = await Deno.open(logPath, { read: true });
      return {
        readable: file.readable,
        stop: () => {},
      };
    } else {
      let stopper = () => {};
      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          const file = await Deno.open(logPath, { read: true });
          const watcher = Deno.watchFs(logPath);
          const buffer = new Uint8Array(1024);

          const pump = async () => {
            while (true) {
              const bytes = await file.read(buffer);
              if (bytes == null) break;
              controller.enqueue(buffer.slice(0, bytes));
            }
          };

          stopper = async () => {
            try {
              await pump();
            } catch (_) { /**/ }
            try {
              watcher.close();
            } catch (_) { /**/ }
            try {
              file.close();
            } catch (_) { /**/ }
            try {
              controller.close();
            } catch (_) { /**/ }
          };

          await pump();
          for await (const e of watcher) {
            if (e.kind !== "modify") continue;
            await pump();
          }
        },
      });

      return { readable, stop: () => stopper() };
    }
  }

  private buildLogPath(id: LogIdentifier) {
    return join("logs", ...id.category, `${id.name}.txt`);
  }
}

export const logStorage = new LogStorage();
