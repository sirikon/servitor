import { Database } from "sqlite3/mod.ts";

export class RelationalDatabase {
  private db: Database;

  constructor(
    private databaseClazz: typeof Database,
  ) {
    this.db = new this.databaseClazz("servitor.db");
  }

  public getSqliteVersion() {
    const [version] = this.db
      .prepare("select sqlite_version()").value<[string]>()!;
    return version;
  }
}

export const relationalDatabase = new RelationalDatabase(Database);
