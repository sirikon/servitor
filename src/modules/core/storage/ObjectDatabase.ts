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
}

export const objectDatabase = new ObjectDatabase();
