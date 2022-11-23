import { Application, Router } from "oak/mod.ts";
import { SeedLogStorage, seedLogStorage } from "@/core/seed/SeedLogStorage.ts";
import { seedActions } from "@/core/seed/SeedActions.ts";

export class WebApplication {
  constructor(
    private oak: Application,
    private router: Router,
    private seedLogStorage: SeedLogStorage,
  ) {
    this.configureOak();
  }

  private configureOak() {
    this.router.get("/api/debug/resources", (ctx) => {
      ctx.response.body = Deno.resources();
    });

    this.router.post("/api/seed/execute", async (ctx) => {
      ctx.response.body = await seedActions.createExecution();
    });

    this.oak.use(async (ctx, next) => {
      ctx.response.headers.set("access-control-allow-origin", "*");
      await next();
    });
    this.oak.use(this.router.routes());
    this.oak.use(this.router.allowedMethods());
  }

  public async handle(
    request: Request,
    conn: Deno.Conn,
  ): Promise<Response | undefined> {
    const seedLogData = new URL(request.url).pathname.match(
      /^\/api\/seed\/executions\/([0-9]+)\/logs$/,
    );
    if (seedLogData) {
      const id = parseInt(seedLogData[1]);
      const seedLog = await this.seedLogStorage.readExecutionLog({ id });
      return new Response(seedLog, {
        headers: {
          "access-control-allow-origin": "*",
          "content-type": "text/plain",
          "x-content-type-options": "nosniff",
        },
      });
    }
    return await this.oak.handle(request, conn);
  }
}

export const webApplication = new WebApplication(
  new Application(),
  new Router(),
  seedLogStorage,
);
