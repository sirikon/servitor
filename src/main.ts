import { seedManager } from "@/app/SeedManager.ts";
import { objectDatabase } from "@/core/storage/ObjectDatabase.ts";

const w = new WritableStream<Uint8Array>({
  write(d) {
    Deno.stdout.write(d);
  },
});

const { execution, done: updateDone } = await seedManager.update();
console.log("Returned", execution);

const { output, done: followDone, stop: stopFollow } = objectDatabase
  .followSeedLog({
    execution,
  });

output.pipeTo(w);

(async () => {
  await updateDone;
  console.log("## Update Done");
  stopFollow();
})();

(async () => {
  await followDone;
  console.log("## Follow Done");
})();
