export class ServitorApi {
  constructor() {}

  public async executeSeed() {
    const response = await fetch("http://127.0.0.1:40000/api/seed/execute", {
      method: "POST",
    });
    return (await response.json()) as Promise<{ execution: number }>;
  }

  public async followSeedLogs(opts: {
    execution: number;
    output: WritableStream<Uint8Array>;
  }) {
    const response = await fetch(
      `http://127.0.0.1:40000/api/seed/${opts.execution}/logs`
    );
    await response.body?.pipeTo(opts.output);
  }
}

export const servitorApi = new ServitorApi();
