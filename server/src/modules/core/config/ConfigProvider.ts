import { Config } from "@/core/config/model.ts";
import { join } from "std/path/mod.ts";

export class ConfigProvider {
  public getConfig(): Promise<Config> {
    return Promise.resolve({
      seed: {
        repo: "https://github.com/srkbz/seed.git",
      },
      web: {
        host: "127.0.0.1",
        port: 40000,
        staticRoot: join(Deno.cwd(), "../src/modules/front"),
      },
    });
  }
}

export const configProvider = new ConfigProvider();
