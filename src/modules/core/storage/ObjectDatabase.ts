import { dirname } from "std/path/win32.ts";
import { ensureDir } from "std/fs/ensure_dir.ts";

export class ObjectDatabase {
  public async createSeedLog(opts: { execution: number }) {
    const logPath = `seed-logs/${opts.execution}.txt`;
    await ensureDir(dirname(logPath));
    return await Deno.open(logPath, {
      createNew: true,
      write: true,
    });
  }
  public followSeedLog(opts: { execution: number }) {
    const logPath = `seed-logs/${opts.execution}.txt`;
    const command = new Deno.Command("tail", {
      args: ["--follow=name", "--silent", "--lines=+0", logPath],
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    });
    command.spawn();
    return {
      done: command.status,
      output: command.stdout,
    };
  }
}

export const objectDatabase = new ObjectDatabase();
