import "reflect_metadata/mod.ts";
import { setConsoleHijackLogger } from "denox/logging/consoleHijack.ts";
import { container } from "tsyringe";
import { EventBus } from "@/core/events/EventBus.ts";
import { Logger } from "./vendor/denox/lib/logging/Logger.ts";
import { WebServerDaemon } from "./modules/app/web/WebServer.ts";
import { SeedSystem } from "./modules/app/seed/SeedSystem.ts";

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
