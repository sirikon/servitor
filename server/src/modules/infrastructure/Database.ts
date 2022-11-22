import { Database as SqliteDatabase, RestBindParameters } from "sqlite3/mod.ts";
import { EventBus, eventBus } from "@/core/events/EventBus.ts";
import { Logger, logger } from "@/core/logging/Logger.ts";

export class Database {
  constructor(
    private logger: Logger,
    private eventBus: EventBus,
    private db: SqliteDatabase,
  ) {
    this.hookEvents();
  }

  public queryAll<T extends Record<string, unknown>>(opts: {
    sql: string;
    params?: RestBindParameters;
  }) {
    const statement = this.db.prepare(opts.sql);
    const result = statement.all<T>(...(opts.params || []));
    statement.finalize();
    return result;
  }

  public queryOne<T extends Record<string, unknown>>(opts: {
    sql: string;
    params?: RestBindParameters;
  }) {
    const statement = this.db.prepare(opts.sql);
    const result = statement.get<T>(...(opts.params || []));
    statement.finalize();
    return result;
  }

  public run(opts: {
    sql: string;
    params?: RestBindParameters;
  }) {
    const statement = this.db.prepare(opts.sql);
    statement.run(...(opts.params || []));
    statement.finalize();
  }

  public exec(opts: {
    sql: string;
  }) {
    this.db.exec(opts.sql);
  }

  private hookEvents() {
    this.eventBus.on("shutdown", () => {
      this.logger.info("Closing database");
      this.db.close();
    });
  }
}

export const database = new Database(
  logger,
  eventBus,
  new SqliteDatabase("data.db"),
);
