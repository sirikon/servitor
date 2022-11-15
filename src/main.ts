import { seedManager } from "./modules/app/SeedManager.ts";
import { objectDatabase } from "./modules/core/storage/ObjectDatabase.ts";

const w = new WritableStream<Uint8Array>({
  write(d) {
    Deno.stdout.write(d);
  },
});

const { execution, done: updateDone } = await seedManager.update();
console.log("Returned", execution);

const { output, done: followDone } = await objectDatabase.followSeedLog({
  execution,
});

output.pipeTo(w);

(async () => {
  await updateDone;
  console.log("Update Done");
})();

(async () => {
  await followDone;
  console.log("Follow Done");
})();
