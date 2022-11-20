import { Config } from "@/core/config/model.ts";

export class ConfigProvider {
  public getConfig(): Promise<Config> {
    return Promise.resolve({
      seed: {
        repo: "https://github.com/srkbz/seed.git",
      },
      web: {
        host: "127.0.0.1",
        port: 40000,
      },
    });
  }
}

export const configProvider = new ConfigProvider();
