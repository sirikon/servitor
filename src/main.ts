import { seedManager } from "@/app/SeedManager.ts";
import { objectDatabase } from "@/core/storage/ObjectDatabase.ts";

const w = new WritableStream<Uint8Array>({
  write(d) {
    Deno.stdout.write(d);
  },
});

const { execution, done: updateDone } = await seedManager.update();
console.log("Returned", execution);

const command = objectDatabase.followSeedLog({
  execution,
});

command.stdout.pipeTo(w);

(async () => {
  await updateDone;
  console.log("## Update Done");
  command.kill();
})();

(async () => {
  await command.status;
  console.log("## Follow Done");
})();
