import { dockerDriver } from "./modules/containers/DockerDriver.ts";

const file = await Deno.open("log.txt", { create: true, write: true, truncate: true });

const w1 = new WritableStream<Uint8Array>({
  write(d) {
    file.write(d);
  },
});
const w2 = new WritableStream<Uint8Array>({
  write(d) {
    file.write(d);
  },
});

const result = await dockerDriver.run(
  "ubuntu",
  "apt-get update && apt-get install -y iputils-ping && ping -c 4 8.8.8.8",
  w1,
  w2,
);
file.close();
console.log("Code", result);
