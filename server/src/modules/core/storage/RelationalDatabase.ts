import { Database } from "sqlite3/mod.ts";

export class RelationalDatabase {
  private db: Database;

  constructor(
    private databaseClazz: typeof Database,
  ) {
    this.db = new this.databaseClazz("data.db");
    this.db.exec(init);

    Deno.addSignalListener("SIGINT", () => {
      console.log("Closing db");
    });
  }

  public insertSeedExecution() {
    const stmt = this.db.prepare(
      "INSERT INTO seed_executions (date) VALUES (unixepoch('now')) RETURNING id",
    );
    const [id] = stmt.value<[number]>()!;
    stmt.finalize();
    return id;
  }

  public getSqliteVersion() {
    const [version] = this.db
      .prepare("select sqlite_version()").value<[string]>()!;
    return version;
  }
}

const init = `
BEGIN;
CREATE TABLE IF NOT EXISTS seed_executions (
  id INTEGER PRIMARY KEY,
  date INTEGER NOT NULL
);
COMMIT;
`;

export const relationalDatabase = new RelationalDatabase(Database);
