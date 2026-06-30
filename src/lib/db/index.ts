import fs from "fs";
import path from "path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { runV1bMigrations } from "./migrate-v1b";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "kurly.db");

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

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __kurlyLibsql: ReturnType<typeof createClient> | undefined;
  // eslint-disable-next-line no-var
  var __kurlyDbReady: Promise<void> | undefined;
}

function createLibsqlClient() {
  ensureDataDir();
  return createClient({ url: `file:${DB_PATH}` });
}

const client = global.__kurlyLibsql ?? createLibsqlClient();
if (process.env.NODE_ENV !== "production") {
  global.__kurlyLibsql = client;
}

async function runMigrations() {
  for (const statement of MIGRATION_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await client.execute(statement);
  }
  await runV1bMigrations(client);
}

const readyPromise = global.__kurlyDbReady ?? runMigrations();
if (process.env.NODE_ENV !== "production") {
  global.__kurlyDbReady = readyPromise;
}

export async function ensureDbReady() {
  await readyPromise;
}

export const db = drizzle(client, { schema });
export { DB_PATH, client };
