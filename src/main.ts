import { seedManager } from "@/app/SeedManager.ts";
// import { objectDatabase } from "@/core/storage/ObjectDatabase.ts";

import { webServerDaemon } from "@/daemon/WebServerDaemon.ts";

const { execution } = await seedManager.update();
console.log("http://localhost:40000/seed-logs/" + execution);

await webServerDaemon.start();
