import React, { useEffect, useState } from "react";
import { servitorApi } from "../../services/ServitorApi";

export const SeedLogs = ({ execution }: { execution: number }) => {
  const [logs, setLogs] = useState("");

  useEffect(() => {
    (async () => {
      const textDecoder = new TextDecoderStream();
      servitorApi.followSeedLogs({ execution, output: textDecoder.writable });
      const reader = textDecoder.readable.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setLogs((l) => l + value);
      }
    })();
  }, []);

  return <pre>{logs}</pre>;
};
