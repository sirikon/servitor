import { serve } from "std/http/server.ts";
import {
  ConfigProvider,
  configProvider,
} from "@/core/config/ConfigProvider.ts";

export class WebServerDaemon {
  constructor(
    private configProvider: ConfigProvider,
    private serveFunc: typeof serve,
  ) {}

  public async start() {
    const config = await this.configProvider.getConfig();
    await this.serveFunc(this.requestHandler.bind(this), {
      hostname: config.web.host,
      port: config.web.port,
      onListen: ({ hostname, port }) => {
        console.log(`-> http://${hostname}:${port}`);
      },
    });
  }

  private requestHandler(request: Request): Response {
    const body = `Your user-agent is:\n\n${
      request.headers.get("user-agent") ?? "Unknown"
    }`;
    return new Response(body, { status: 200 });
  }
}

export const webServerDaemon = new WebServerDaemon(configProvider, serve);
