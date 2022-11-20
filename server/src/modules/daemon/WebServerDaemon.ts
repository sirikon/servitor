import {
  ConfigProvider,
  configProvider,
} from "@/core/config/ConfigProvider.ts";
import { WebApplication, webApplication } from "../app/web/WebApplication.ts";

export class WebServerDaemon {
  constructor(
    private configProvider: ConfigProvider,
    private webApplication: WebApplication,
  ) {}

  public async start() {
    const config = await this.configProvider.getConfig();

    const listener = Deno.listen({
      hostname: config.web.host,
      port: config.web.port,
    });
    console.log(`http://127.0.0.1:${config.web.port}`);

    for await (const conn of listener) {
      (async () => {
        console.log("=== Conn", conn.rid);
        try {
          const requests = Deno.serveHttp(conn);
          for await (const { request, respondWith } of requests) {
            console.log("=== Request", request.url, request.method);
            try {
              const { response } = await this.webApplication.handle(
                request,
                conn,
              );
              if (response) {
                await respondWith(response);
              }
            } catch (e) {
              if (
                e instanceof Deno.errors.Http &&
                e.message === "connection closed before message completed"
              ) {
                console.log("=== Connection closed", conn.rid);
                return;
              }
              await respondWith(new Response(null, { status: 500 }));
            }
          }
        } catch (e) {
          console.log(e);
          conn.close();
        }
      })();
    }
  }
}

export const webServerDaemon = new WebServerDaemon(
  configProvider,
  webApplication,
);
