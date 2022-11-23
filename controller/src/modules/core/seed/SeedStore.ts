import EventEmitter from "eventemitter3";
import { Database, database } from "@/infrastructure/Database.ts";

export type SeedExecution = {
  id: number;
  status: "created" | "scheduled" | "running" | "finished";
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
      sql:
        "INSERT INTO seed_executions (status, createDate) VALUES (?, ?) RETURNING *",
      params: ["created", Date.now()],
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

  public scheduleExecution(opts: { id: number }) {
    const execution = this.database.queryOne<SeedExecution>({
      sql: "UPDATE seed_executions SET status = ? WHERE id = ? RETURNING *",
      params: ["scheduled", opts.id],
    })!;
    this.events.emit("execution-updated", { execution });
  }

  public startExecution(opts: { id: number; startDate: number }) {
    const execution = this.database.queryOne<SeedExecution>({
      sql:
        "UPDATE seed_executions SET status = ?, startDate = ? WHERE id = ? RETURNING *",
      params: ["running", opts.startDate, opts.id],
    })!;
    this.events.emit("execution-updated", { execution });
  }

  public endExecution(opts: { id: number; endDate: number }) {
    const execution = this.database.queryOne<SeedExecution>({
      sql:
        "UPDATE seed_executions SET status = ?, endDate = ? WHERE id = ? RETURNING *",
      params: ["finished", opts.endDate, opts.id],
    })!;
    this.events.emit("execution-updated", { execution });
  }
}

const init = `
BEGIN;
CREATE TABLE IF NOT EXISTS seed_executions (
  id INTEGER PRIMARY KEY,
  status TEXT NOT NULL,
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
