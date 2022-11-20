import { Application, Router } from "oak/mod.ts";
import { seedSystem } from "@/app/systems/SeedSystem.ts";
import { LogStorage, logStorage } from "../../core/storage/LogStorage.ts";

export class WebApplication {
  constructor(
    private oak: Application,
    private router: Router,
    private logStorage: LogStorage,
  ) {
    this.configureOak();
  }

  private configureOak() {
    this.router.post("/api/seed/execute", async (ctx) => {
      const { execution } = await seedSystem.execute();
      ctx.response.headers.set("access-control-allow-origin", "*");
      ctx.response.body = { execution };
    });

    this.oak.use(this.router.routes());
    this.oak.use(this.router.allowedMethods());
  }

  public async handle(
    request: Request,
    conn: Deno.Conn,
  ): Promise<Response> {
    const seedLogData = new URL(request.url).pathname.match(
      /^\/api\/seed\/([0-9]+)\/logs$/,
    );
    if (seedLogData) {
      const execution = parseInt(seedLogData[1]);
      const seedLog = await this.logStorage.readSeedLog({ execution });
      return new Response(seedLog, {
        headers: {
          "access-control-allow-origin": "*",
          "content-type": "application/octet-stream",
          "x-content-type-options": "nosniff",
        },
      });
    }
    return (await this.oak.handle(request, conn) ||
      new Response(null, { status: 404 }));
  }
}

export const webApplication = new WebApplication(
  new Application(),
  new Router(),
  logStorage,
);
