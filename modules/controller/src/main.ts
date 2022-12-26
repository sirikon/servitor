import { eventBus } from "@/core/events/EventBus.ts";
import { webServerDaemon } from "@/app/web/WebServer.ts";
import { seedSystem } from "./modules/app/seed/SeedSystem.ts";

Deno.addSignalListener("SIGINT", () => {
  eventBus.emit("shutdown");
});

webServerDaemon.start();
seedSystem.start();
