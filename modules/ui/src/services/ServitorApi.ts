import { SeedExecution } from "@/models/seed";

export const BASE_URL = "http://127.0.0.1:40000";

export class ServitorApi {
  constructor() {}

  public async executeSeed() {
    const response = await fetch(`${BASE_URL}/api/seed/execute`, {
      method: "POST",
    });
    const data = (await response.json()) as { id: number };
    return data;
  }

  public subscribeToSeedExecutions(cb: (execution: SeedExecution) => void) {
    const abortController = new AbortController();
    const textDecoder = new TextDecoderStream();
    let buffer = "";

    const processBuffer = () => {
      const regex = /\n/g;
      let match: RegExpExecArray | null = null;
      let lastIndex: number | null = null;
      while ((match = regex.exec(buffer)) != null) {
        const chunk = buffer.substring(
          lastIndex != null ? lastIndex + 1 : 0,
          match.index
        );
        cb(JSON.parse(chunk));
        lastIndex = match.index;
      }
      buffer = buffer.substring(lastIndex != null ? lastIndex + 1 : 0);
    };

    fetch(`${BASE_URL}/api/seed/executions/subscribe`, {
      method: "POST",
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (response.body == null) {
          throw new Error("Response body is null");
        }
        const reader = response.body.pipeThrough(textDecoder).getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          processBuffer();
        }
      })
      .catch((err) => {
        if (
          err instanceof DOMException &&
          err.code === DOMException.ABORT_ERR
        ) {
          return;
        }
        console.error(
          "Error on ServitorApi.subscribeToSeedExecutions fetch:",
          err
        );
      });

    return () => abortController.abort();
  }
}

export const servitorApi = new ServitorApi();
