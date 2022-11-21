import { dirname, join } from "std/path/mod.ts";
import { ensureDir } from "std/fs/ensure_dir.ts";
import { EventBus, eventBus } from "../events/EventBus.ts";
import { Database, database } from "./Database.ts";

type SeedLogIdentifier = {
  id: number;
};

type LogIdentifier = {
  category: string[];
  name: string;
};

export class LogStorage {
  constructor(
    private eventBus: EventBus,
    private database: Database,
  ) {}

  public async createSeedLog(opts: SeedLogIdentifier) {
    return await this.createLog({
      category: ["seed"],
      name: opts.id.toString(),
    });
  }

  public async readSeedLog(opts: SeedLogIdentifier) {
    const isRunning = this.isSeedExecutionRunning(opts);
    const { readable, stop } = await this.readLog({
      category: ["seed"],
      name: opts.id.toString(),
      mode: isRunning ? "stream" : "read-full",
    });

    isRunning && (() => {
      const handler = (event: { id: number }) => {
        if (event.id === opts.id) {
          stop();
          this.eventBus.off("seed-execution-ended", handler);
        }
      };
      this.eventBus.on("seed-execution-ended", handler);
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

  private isSeedExecutionRunning(opts: { id: number }) {
    const seedExecution = this.database.getSeedExecution(opts);
    if (!seedExecution) return false;

    return seedExecution.start_date != null && seedExecution.end_date == null;
  }
}

export const logStorage = new LogStorage(eventBus, database);
