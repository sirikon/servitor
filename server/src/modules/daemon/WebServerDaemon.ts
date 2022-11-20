import {
  ConfigProvider,
  configProvider,
} from "@/core/config/ConfigProvider.ts";
import { WebApplication, webApplication } from "@/app/web/WebApplication.ts";

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
            const response = await this.webApplication.handle(request, conn)
              .catch((err) => {
                console.log(err);
                return new Response(null, { status: 500 });
              });

            try {
              response && await respondWith(response);
            } catch (err) {
              if (!isConnectionClosedError(err)) {
                console.log(err);
              }
            }
          }
        } catch (err) {
          console.log(err);
        }
      })();
    }
  }
}

export const webServerDaemon = new WebServerDaemon(
  configProvider,
  webApplication,
);

const isConnectionClosedError = (e: unknown) => {
  return e instanceof Deno.errors.Http &&
    e.message === "connection closed before message completed";
};
