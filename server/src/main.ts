import { webServerDaemon } from "@/daemon/WebServerDaemon.ts";

setInterval(() => {
  console.log(Deno.resources());
}, 1000);

await webServerDaemon.start();
