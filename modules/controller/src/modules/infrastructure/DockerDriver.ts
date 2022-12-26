import { singleton } from "tsyringe";

export type DockerBuildOpts = {
  image: string;
  dockerfile: string;
  context: string;
  stdout: WritableStream<Uint8Array>;
  stderr: WritableStream<Uint8Array>;
};

export type DockerRunOpts = {
  image: string;
  command: string[];
  stdout: WritableStream<Uint8Array>;
  stderr: WritableStream<Uint8Array>;
};

@singleton()
export class DockerDriver {
  constructor() {}

  public async build(opts: DockerBuildOpts) {
    const proc = new Deno.Command("docker", {
      args: [
        "build",
        "-t",
        opts.image,
        "-f",
        opts.dockerfile,
        "--pull",
        opts.context,
      ],
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    }).spawn();

    await Promise.all([
      proc.stdout.pipeTo(opts.stdout),
      proc.stderr.pipeTo(opts.stderr),
    ]);
    return await proc.status;
  }

  public async run(opts: DockerRunOpts) {
    const proc = new Deno.Command("docker", {
      args: ["run", "--rm", opts.image, ...opts.command],
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    }).spawn();

    await Promise.all([
      proc.stdout.pipeTo(opts.stdout),
      proc.stderr.pipeTo(opts.stderr),
    ]);
    return await proc.status;
  }
}
