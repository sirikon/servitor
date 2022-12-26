export type SeedExecution = {
  id: number;
  status: "created" | "scheduled" | "running" | "finished";
  createDate: number;
  startDate: number | null;
  endDate: number | null;
};
