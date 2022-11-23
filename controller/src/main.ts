import { eventBus } from "@/core/events/EventBus.ts";
import { webServerDaemon } from "@/app/web/WebServer.ts";

Deno.addSignalListener("SIGINT", () => {
  eventBus.emit("shutdown");
});

await webServerDaemon.start();
