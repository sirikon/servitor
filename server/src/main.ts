import { webServerDaemon } from "@/daemon/WebServerDaemon.ts";
import { eventBus } from "@/core/events/EventBus.ts";

Deno.addSignalListener("SIGINT", () => {
  eventBus.emit("shutdown");
});

await webServerDaemon.start();
