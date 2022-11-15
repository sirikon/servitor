import { dockerDriver } from "./modules/containers/DockerDriver.ts";

const id = crypto.randomUUID();

const stdout1 = new WritableStream<Uint8Array>({
  write(d) {
    Deno.stdout.write(d);
  },
});
const stderr1 = new WritableStream<Uint8Array>({
  write(d) {
    Deno.stdout.write(d);
  },
});

const buildResult = await dockerDriver.build({
  image: "test-" + id,
  context: "..",
  dockerfile: "../example.dockerfile",
  stdout: stdout1,
  stderr: stderr1,
});
console.log("Build Result", buildResult);

const stdout2 = new WritableStream<Uint8Array>({
  write(d) {
    Deno.stdout.write(d);
  },
});
const stderr2 = new WritableStream<Uint8Array>({
  write(d) {
    Deno.stdout.write(d);
  },
});

const runResult = await dockerDriver.run({
  image: "test-" + id,
  command: [
    "ping",
    "-c",
    "4",
    "8.8.8.8",
  ],
  stdout: stdout2,
  stderr: stderr2,
});

console.log("Run Result", runResult);
