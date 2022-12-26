export class ServitorApi {
  constructor() {}

  public async executeSeed() {
    const response = await fetch("http://127.0.0.1:40000/api/seed/execute", {
      method: "POST",
    });
    const data = (await response.json()) as { id: number };
    return {
      ...data,
      logsUrl: `http://127.0.0.1:40000/api/seed/executions/${data.id}/logs`,
    };
  }
}

export const servitorApi = new ServitorApi();
