import { Application, Router } from "oak/mod.ts";
import {
  ObjectDatabase,
  objectDatabase,
} from "@/core/storage/ObjectDatabase.ts";
import { seedSystem } from "@/app/systems/SeedSystem.ts";

export class WebApplication {
  constructor(
    private oak: Application,
    private router: Router,
    private objectDatabase: ObjectDatabase,
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
  ): Promise<{ response: Response | undefined; done: () => void }> {
    const seedLogData = new URL(request.url).pathname.match(
      /^\/api\/seed\/([0-9]+)\/logs$/,
    );
    if (seedLogData) {
      const execution = parseInt(seedLogData[1]);
      const seedLog = await this.objectDatabase.followSeedLog({ execution });
      return {
        response: new Response(seedLog.output, {
          headers: {
            "access-control-allow-origin": "*",
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
);
