import { Database as SqliteDatabase } from "sqlite3/mod.ts";
import { EventBus, eventBus } from "../events/EventBus.ts";
import { Logger, logger } from "../logging/Logger.ts";

type SeedExecutionsRecord = {
  id: number;
  create_date: number;
  start_date: number | null;
  end_date: number | null;
};

export class Database {
  constructor(
    private logger: Logger,
    private eventBus: EventBus,
    private db: SqliteDatabase,
  ) {
    this.hookEvents();
    this.migrate();
  }

  public insertSeedExecution() {
    const stmt = this.db.prepare(
      "INSERT INTO seed_executions (create_date) VALUES (?) RETURNING id",
    );
    const [id] = stmt.value<[number]>(Date.now())!;
    stmt.finalize();
    return id;
  }

  public getSeedExecution(opts: { id: number }) {
    const stmt = this.db.prepare(
      "SELECT id, create_date, start_date, end_date FROM seed_executions WHERE id = ? LIMIT 1",
    );
    const result = stmt.get<SeedExecutionsRecord>(opts.id);
    stmt.finalize();
    return result;
  }

  public setSeedExecutionStartDate(opts: { id: number; start_date: number }) {
    const stmt = this.db.prepare(
      "UPDATE seed_executions SET start_date = ? WHERE id = ?",
    );
    stmt.run(opts.start_date, opts.id)!;
    stmt.finalize();
  }

  public setSeedExecutionEndDate(opts: { id: number; end_date: number }) {
    const stmt = this.db.prepare(
      "UPDATE seed_executions SET end_date = ? WHERE id = ?",
    );
    stmt.run(opts.end_date, opts.id)!;
    stmt.finalize();
  }

  public getSqliteVersion() {
    const [version] = this.db
      .prepare("select sqlite_version()").value<[string]>()!;
    return version;
  }

  private migrate() {
    this.db.exec(init);
  }

  private hookEvents() {
    this.eventBus.on("shutdown", () => {
      this.logger.info("Closing database");
      this.db.close();
    });
  }
}

const init = `
BEGIN;
CREATE TABLE IF NOT EXISTS seed_executions (
  id INTEGER PRIMARY KEY,
  create_date INTEGER NOT NULL,
  start_date INTEGER NULL,
  end_date INTEGER NULL
);
COMMIT;
`;

export const database = new Database(
  logger,
  eventBus,
  new SqliteDatabase("data.db"),
);
