import { Config } from "./model.ts";

export class ConfigProvider {
  public getConfig(): Promise<Config> {
    return Promise.resolve({
      web: {
        host: "127.0.0.1",
        port: 40000,
      },
    });
  }
}

export const configProvider = new ConfigProvider();
