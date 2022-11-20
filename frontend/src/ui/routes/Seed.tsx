import React, { useCallback, useState } from "react";
import { servitorApi } from "../../services/ServitorApi";
import { LogsViewer } from "../components/LogsViewer";

export default () => {
  const [execution, setExecution] = useState<{
    id: number;
    logsUrl: string;
  } | null>(null);

  const onClick = useCallback(() => {
    (async () => {
      setExecution(null);
      setExecution(await servitorApi.executeSeed());
    })();
  }, [setExecution]);

  return (
    <>
      <p>
        <button type="button" onClick={onClick}>
          Execute
        </button>
      </p>
      <p>{execution?.id || ""}</p>
      {execution && <LogsViewer url={execution.logsUrl} />}
    </>
  );
};
