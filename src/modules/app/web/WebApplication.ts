import { Application, Router } from "oak/mod.ts";
import {
  ObjectDatabase,
  objectDatabase,
} from "@/core/storage/ObjectDatabase.ts";
import {
  ConfigProvider,
  configProvider,
} from "../../core/config/ConfigProvider.ts";

export class WebApplication {
  constructor(
    private oak: Application,
    private router: Router,
    private objectDatabase: ObjectDatabase,
    private configProvider: ConfigProvider,
  ) {
    this.configureOak();
  }

  private configureOak() {
    this.router.get("/(.*)", async (ctx) => {
      const config = await this.configProvider.getConfig();
      const path = ctx.request.url.pathname === "/" ? "index.html" : undefined;
      await ctx.send({ root: config.web.staticRoot, path });
    });

    this.oak.use(this.router.routes());
    this.oak.use(this.router.allowedMethods());
  }

  public async handle(
    request: Request,
    conn: Deno.Conn,
  ): Promise<{ response: Response | undefined; done: () => void }> {
    const seedLogData = new URL(request.url).pathname.match(
      /^\/seed-logs\/([0-9]+)$/,
    );
    if (seedLogData) {
      const execution = parseInt(seedLogData[1]);
      const seedLog = await this.objectDatabase.followSeedLog({ execution });
      return {
        response: new Response(seedLog.output, {
          headers: {
            "content-type": "application/octet-stream",
            "x-content-type-options": "nosniff",
          },
        }),
        done: () => {
          seedLog.stop();
        },
      };
    }
    return { response: await this.oak.handle(request, conn), done: () => {} };
  }
}

export const webApplication = new WebApplication(
  new Application(),
  new Router(),
  objectDatabase,
  configProvider,
);
