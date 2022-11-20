import React, { useCallback, useState } from "react";
import { servitorApi } from "../../services/ServitorApi";
import { SeedLogs } from "../components/SeedLogs";

export default () => {
  const [seedExecution, setSeedExecution] = useState<number | null>(null);

  const onClick = useCallback(() => {
    (async () => {
      const { execution } = await servitorApi.executeSeed();
      setSeedExecution(execution);
    })();
  }, [setSeedExecution]);

  return (
    <>
      <p>
        <button type="button" onClick={onClick}>
          Execute
        </button>
      </p>
      <p>{seedExecution || ""}</p>
      {seedExecution && <SeedLogs execution={seedExecution} />}
    </>
  );
};
