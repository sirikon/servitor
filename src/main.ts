import { relationalDatabase } from "./modules/core/storage/RelationalDatabase.ts";
import { webServerDaemon } from "./modules/daemon/WebServerDaemon.ts";

console.log(relationalDatabase.getSqliteVersion());
await webServerDaemon.start();
