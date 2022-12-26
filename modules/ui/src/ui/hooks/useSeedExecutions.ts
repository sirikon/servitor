import { useEffect, useState } from "react";
import { SeedExecution } from "../../models/seed";
import { servitorApi } from "../../services/ServitorApi";

export const useSeedExecutions = () => {
  const [executionsIndex, setExecutionsIndex] = useState<
    Record<SeedExecution["id"], SeedExecution>
  >({});

  useEffect(() => {
    const close = servitorApi.subscribeToSeedExecutions((execution) => {
      setExecutionsIndex((executions) => {
        return {
          ...executions,
          [execution.id]: execution,
        };
      });
    });
    return () => close();
  }, []);

  return Object.values(executionsIndex).sort((a, b) => a.id - b.id);
};
