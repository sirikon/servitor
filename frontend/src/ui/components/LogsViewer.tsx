import React, { useEffect, useState } from "react";

export const LogsViewer = ({ url }: { url: string }) => {
  const [logs, setLogs] = useState("");

  useEffect(() => {
    console.log("New url", url);
    setLogs("");
    const abortController = new AbortController();
    const textDecoder = new TextDecoderStream();
    fetch(url, { signal: abortController.signal })
      .then(async (response) => {
        const reader = response.body!.pipeThrough(textDecoder).getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          setLogs((l) => l + value);
        }
        console.log("Done!");
      })
      .catch((err) => {
        if (
          err instanceof DOMException &&
          err.code === DOMException.ABORT_ERR
        ) {
          return;
        }
        console.log(err);
      });
    return () => abortController.abort();
  }, [url]);

  return <pre>{logs}</pre>;
};
