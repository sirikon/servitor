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
        try {
          const requests = Deno.serveHttp(conn);
          for await (const { request, respondWith } of requests) {
            try {
              const { response, done } = await this.webApplication.handle(
                request,
                conn,
              );
              try {
                if (response) {
                  await respondWith(response);
                }
              } finally {
                done();
              }
            } catch (e) {
              if (
                e instanceof Deno.errors.Http &&
                e.message === "connection closed before message completed"
              ) return;
              await respondWith(new Response(null, { status: 500 }));
            }
          }
        } catch (e) {
          console.log(e);
        }
      })();
    }
  }
}

export const webServerDaemon = new WebServerDaemon(
  configProvider,
  webApplication,
);
