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

export class DockerDriver {
  constructor() {}

  public async build(opts: DockerBuildOpts) {
    const cmd = new Deno.Command("docker", {
      args: ["build", "-t", opts.image, "-f", opts.dockerfile, "--pull", opts.context],
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    });
    cmd.spawn();

    await Promise.all([
      cmd.stdout.pipeTo(opts.stdout),
      cmd.stderr.pipeTo(opts.stderr),
    ]);
    return await cmd.status;
  }

  public async run(opts: DockerRunOpts) {
    const cmd = new Deno.Command("docker", {
      args: ["run", "--rm", opts.image, ...opts.command],
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    });
    cmd.spawn();

    await Promise.all([
      cmd.stdout.pipeTo(opts.stdout),
      cmd.stderr.pipeTo(opts.stderr),
    ]);
    return await cmd.status;
  }
}

export const dockerDriver = new DockerDriver();
