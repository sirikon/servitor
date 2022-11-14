export class DockerDriver {
  constructor() {}

  public async run(image: string, command: string, stdout: WritableStream, stderr: WritableStream) {
    const cmd = new Deno.Command("docker", {
      args: ["run", image, "sh", "-c", command],
      stdin: "null",
    });
    cmd.spawn();

    await Promise.all([
      cmd.stdout.pipeTo(stdout),
      cmd.stderr.pipeTo(stderr),
    ]);
    return await cmd.status;
  }
}

export const dockerDriver = new DockerDriver();
