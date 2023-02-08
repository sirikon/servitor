import "reflect_metadata/mod.ts";
import { setConsoleHijackLogger } from "denox/logging/consoleHijack.ts";
import { container } from "tsyringe";
import { EventBus } from "@/core/events/EventBus.ts";
import { Logger } from "denox/logging/Logger.ts";
import { WebServerDaemon } from "@/app/web/WebServer.ts";
import { SeedSystem } from "@/app/seed/SeedSystem.ts";

const eventBus = container.resolve(EventBus);
const log = container.resolve(Logger);
const webServerDaemon = container.resolve(WebServerDaemon);
const seedSystem = container.resolve(SeedSystem);

setConsoleHijackLogger(log);
Deno.addSignalListener("SIGINT", () => {
  log.info("Shutting down");
  eventBus.emit("shutdown");
});

webServerDaemon.start();
seedSystem.start();
