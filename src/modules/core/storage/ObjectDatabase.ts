import { dirname } from "std/path/win32.ts";
import { ensureDir } from "std/fs/ensure_dir.ts";
import { GlobalState, globalState } from "../state/GlobalState.ts";
import { copy } from "std/streams/conversion.ts";

export type FollowSeedLogResult = {
  output: ReadableStream<Uint8Array>;
  stop: () => void;
};

export class ObjectDatabase {
  constructor(
    private globalState: GlobalState,
  ) {}

  public async createSeedLog(opts: { execution: number }) {
    const logPath = `seed-logs/${opts.execution}.txt`;
    await ensureDir(dirname(logPath));
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
        stop: () => {
          file.close();
        },
      };
    }

    const command = new Deno.Command("tail", {
      args: ["--follow=name", "--silent", "--lines=+0", logPath],
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    });
    command.spawn();

    const stop = () => command.kill();

    (async () => {
      const handler = (event: { execution: number }) => {
        event.execution === opts.execution && stop();
      };
      this.globalState.eventEmitter.on("seed-execution-ended", handler);
      await command.status;
      this.globalState.eventEmitter.off("seed-execution-ended", handler);
    })();

    return {
      output: command.stdout,
      stop,
    };
  }
}

export const objectDatabase = new ObjectDatabase(globalState);
