import { seedManager } from "@/app/SeedManager.ts";
import { objectDatabase } from "@/core/storage/ObjectDatabase.ts";

const w = new WritableStream<Uint8Array>({
  write(d) {
    Deno.stdout.write(d);
  },
});

const { execution } = await seedManager.update();
console.log("Returned", execution);
// const execution = 1668620216687;

const { output, stop } = await objectDatabase
  .followSeedLog({
    execution,
  });

await output.pipeTo(w);
console.log("DONE");
stop();
