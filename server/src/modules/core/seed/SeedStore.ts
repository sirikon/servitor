import EventEmitter from "eventemitter3";
import { Database, database } from "@/infrastructure/Database.ts";

export type SeedExecution = {
  id: number;
  createDate: number;
  startDate: number | null;
  endDate: number | null;
};

type SeedStoreEvents = {
  "execution-updated": (args: { execution: SeedExecution }) => void;
};

export class SeedStore {
  constructor(
    public events: EventEmitter<SeedStoreEvents>,
    private database: Database,
  ) {
    this.database.exec({ sql: init });
  }

  public createExecution() {
    const execution = this.database.queryOne<SeedExecution>({
      sql: "INSERT INTO seed_executions (createDate) VALUES (?) RETURNING *",
      params: [Date.now()],
    })!;
    this.events.emit("execution-updated", { execution });
    return execution;
  }

  public getExecution(opts: { id: number }) {
    return this.database.queryOne<SeedExecution>({
      sql: "SELECT * FROM seed_executions WHERE id = ? LIMIT 1",
      params: [opts.id],
    }) || null;
  }

  public setExecutionStartDate(opts: { id: number; startDate: number }) {
    const execution = this.database.queryOne<SeedExecution>({
      sql: "UPDATE seed_executions SET startDate = ? WHERE id = ? RETURNING *",
      params: [opts.startDate, opts.id],
    })!;
    this.events.emit("execution-updated", { execution });
  }

  public setExecutionEndDate(opts: { id: number; endDate: number }) {
    const execution = this.database.queryOne<SeedExecution>({
      sql: "UPDATE seed_executions SET endDate = ? WHERE id = ? RETURNING *",
      params: [opts.endDate, opts.id],
    })!;
    this.events.emit("execution-updated", { execution });
  }
}

const init = `
BEGIN;
CREATE TABLE IF NOT EXISTS seed_executions (
  id INTEGER PRIMARY KEY,
  createDate INTEGER NOT NULL,
  startDate INTEGER NULL,
  endDate INTEGER NULL
);
COMMIT;
`;

export const seedStore = new SeedStore(
  new EventEmitter(),
  database,
);
