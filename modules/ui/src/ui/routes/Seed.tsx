import { BASE_URL, servitorApi } from "@/services/ServitorApi";
import React, { useCallback, useState } from "react";
import { useSeedExecutions } from "@/ui/hooks/useSeedExecutions";
import { LogsViewer } from "@/ui/components/LogsViewer";

export default () => {
  const executions = useSeedExecutions();
  const [visibleExecution, setVisibleExecution] = useState<number | null>(null);

  const onClick = useCallback(() => {
    (async () => {
      setVisibleExecution(null);
      const execution = await servitorApi.executeSeed();
      setVisibleExecution(execution.id);
    })();
  }, [setVisibleExecution]);

  return (
    <>
      <p>
        <button type="button" onClick={onClick}>
          Execute
        </button>
      </p>
      <ul>
        {executions.map((e) => (
          <li>
            <button type="button" onClick={() => setVisibleExecution(e.id)}>
              {e.id}[{e.status}]
            </button>
          </li>
        ))}
      </ul>
      <p>{visibleExecution || ""}</p>
      {visibleExecution && (
        <LogsViewer
          url={`${BASE_URL}/api/seed/executions/${visibleExecution}/logs`}
        />
      )}
    </>
  );
};
