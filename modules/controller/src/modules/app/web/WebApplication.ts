import { Application, Router } from "oak/mod.ts";
import { SeedLogStorage, seedLogStorage } from "@/core/seed/SeedLogStorage.ts";
import { seedActions } from "@/core/seed/SeedActions.ts";
import { SeedExecution, seedStore } from "../../core/seed/SeedStore.ts";

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

    this.router.post("/api/seed/executions/subscribe", (ctx) => {
      const textEncoder = new TextEncoder();
      let close = () => {};
      const reader = new ReadableStream<Uint8Array>({
        start(controller) {
          const handler = ({ execution }: { execution: SeedExecution }) => {
            const chunk = textEncoder.encode(JSON.stringify(execution) + "\n");
            controller.enqueue(chunk);
          };
          seedStore.events.on("execution-updated", handler);
          close = () => seedStore.events.off("execution-updated", handler);
        },
        cancel() {
          close();
        },
      });
      ctx.response.headers.set("content-type", "text/plain");
      ctx.response.headers.set("x-content-type-options", "nosniff");
      ctx.response.body = reader;
    });

    this.router.get("/api/seed/executions/:id/logs", async (ctx) => {
      ctx.response.headers.set("content-type", "text/plain");
      ctx.response.headers.set("x-content-type-options", "nosniff");
      ctx.response.body = await this.seedLogStorage.readExecutionLog({
        id: parseInt(ctx.params.id),
      });
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
    return await this.oak.handle(request, conn);
  }
}

export const webApplication = new WebApplication(
  new Application(),
  new Router(),
  seedLogStorage,
);
