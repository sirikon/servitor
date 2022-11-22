import { Database, database } from "@/infrastructure/Database.ts";

export type SeedExecution = {
  id: number;
  createDate: number;
  startDate: number | null;
  endDate: number | null;
};

export class SeedDatabase {
  constructor(
    private database: Database,
  ) {
    this.database.exec({ sql: init });
  }

  public createExecution() {
    return this.database.queryOne<SeedExecution>({
      sql: "INSERT INTO seed_executions (createDate) VALUES (?) RETURNING *",
      params: [Date.now()],
    })!;
  }

  public getExecution(opts: { id: number }) {
    return this.database.queryOne<SeedExecution>({
      sql: "SELECT * FROM seed_executions WHERE id = ? LIMIT 1",
      params: [opts.id],
    }) || null;
  }

  public setExecutionStartDate(opts: { id: number; startDate: number }) {
    this.database.run({
      sql: "UPDATE seed_executions SET startDate = ? WHERE id = ?",
      params: [opts.startDate, opts.id],
    });
  }

  public setExecutionEndDate(opts: { id: number; endDate: number }) {
    this.database.run({
      sql: "UPDATE seed_executions SET endDate = ? WHERE id = ?",
      params: [opts.endDate, opts.id],
    });
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

export const seedDatabase = new SeedDatabase(database);
