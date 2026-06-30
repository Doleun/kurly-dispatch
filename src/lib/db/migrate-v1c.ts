import type { Client } from "@libsql/client";

async function tableExists(client: Client, table: string): Promise<boolean> {
  const result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    [table],
  );
  return result.rows.length > 0;
}

async function getSchemaVersion(client: Client): Promise<number> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY
    )
  `);
  const result = await client.execute("SELECT MAX(version) AS v FROM schema_migrations");
  return Number(result.rows[0]?.v ?? 0);
}

async function setSchemaVersion(client: Client, version: number) {
  await client.execute("INSERT OR REPLACE INTO schema_migrations (version) VALUES (?)", [
    version,
  ]);
}

async function createLeaveTables(client: Client) {
  if (!(await tableExists(client, "driver_weekly_leaves"))) {
    await client.execute(`
      CREATE TABLE driver_weekly_leaves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
        driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
        time_slot TEXT NOT NULL CHECK (time_slot IN ('first', 'second')),
        weekday INTEGER NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(driver_id, time_slot, weekday)
      )
    `);
    await client.execute(`
      CREATE INDEX IF NOT EXISTS weekly_leaves_center_slot
      ON driver_weekly_leaves (center_id, time_slot)
    `);
  }

  if (!(await tableExists(client, "driver_leave_exceptions"))) {
    await client.execute(`
      CREATE TABLE driver_leave_exceptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
        driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
        time_slot TEXT NOT NULL CHECK (time_slot IN ('first', 'second')),
        leave_date TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'leave' CHECK (kind IN ('leave', 'work')),
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(driver_id, time_slot, leave_date)
      )
    `);
    await client.execute(`
      CREATE INDEX IF NOT EXISTS leave_exceptions_center_date
      ON driver_leave_exceptions (center_id, leave_date)
    `);
  }
}

export async function runV1cMigrations(client: Client) {
  const version = await getSchemaVersion(client);
  if (version < 5) {
    await createLeaveTables(client);
    await setSchemaVersion(client, 5);
  }
}
