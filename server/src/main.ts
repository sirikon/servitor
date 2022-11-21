import { webServerDaemon } from "@/daemon/WebServerDaemon.ts";
import { eventBus } from "./modules/core/events/EventBus.ts";

Deno.addSignalListener("SIGINT", () => {
  eventBus.emit("shutdown");
});

await webServerDaemon.start();
