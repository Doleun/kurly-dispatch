import fs from "fs";
import path from "path";
import { createClient } from "@libsql/client";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(process.cwd(), "data", "kurly.db");

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS drivers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  default_time_slot TEXT NOT NULL CHECK (default_time_slot IN ('first', 'second')),
  max_capacity INTEGER,
  capability_note TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS zone_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  zone_id INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  time_slot TEXT NOT NULL CHECK (time_slot IN ('first', 'second')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(driver_id, zone_id, time_slot)
);

CREATE TABLE IF NOT EXISTS random_pool_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  time_slot TEXT NOT NULL CHECK (time_slot IN ('first', 'second')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(driver_id, time_slot)
);
`;

async function migrate() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const client = createClient({ url: `file:${DB_PATH}` });

  for (const statement of MIGRATION_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await client.execute(statement);
  }

  client.close();
  console.log(`Migration complete: ${DB_PATH}`);
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
