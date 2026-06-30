import type { Client } from "@libsql/client";
import { zoneCodeToSortOrder } from "@/lib/zone-sort";

function parseZoneCode(code: string): { baseCode: string; subCode: string } {
  const trimmed = code.trim();
  const match = trimmed.match(/^(\d+-\d+)(.*)$/);
  if (match) {
    return { baseCode: match[1], subCode: match[2]?.trim() || "" };
  }
  return { baseCode: trimmed, subCode: "" };
}

async function tableExists(client: Client, table: string): Promise<boolean> {
  const result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    [table],
  );
  return result.rows.length > 0;
}

async function columnExists(client: Client, table: string, column: string): Promise<boolean> {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return result.rows.some((row) => row.name === column);
}

async function seedDefaultCenters(client: Client): Promise<{ daeguId: number; ulsanId: number }> {
  const existing = await client.execute("SELECT id, name FROM centers ORDER BY id");
  if (existing.rows.length >= 2) {
    const daegu = existing.rows.find((r) => r.name === "대구");
    const ulsan = existing.rows.find((r) => r.name === "울산");
    return {
      daeguId: Number(daegu?.id ?? existing.rows[0].id),
      ulsanId: Number(ulsan?.id ?? existing.rows[1].id),
    };
  }

  await client.execute({
    sql: `INSERT INTO centers (name, use_sub_zones, id_borrow_policy, is_active)
          VALUES (?, ?, ?, 1), (?, ?, ?, 1)`,
    args: ["대구", 0, "fixed_1_1", "울산", 1, "daily_override"],
  });

  const centers = await client.execute("SELECT id, name FROM centers ORDER BY id");
  const daeguId = Number(centers.rows.find((r) => r.name === "대구")?.id);
  const ulsanId = Number(centers.rows.find((r) => r.name === "울산")?.id);

  const ulsanSubCodes = ["가", "나", "다", "라", "마", "바", "사"];
  for (let i = 0; i < ulsanSubCodes.length; i++) {
    await client.execute({
      sql: "INSERT OR IGNORE INTO center_sub_codes (center_id, label, sort_order) VALUES (?, ?, ?)",
      args: [ulsanId, ulsanSubCodes[i], i + 1],
    });
  }

  return { daeguId, ulsanId };
}

async function migrateUsers(client: Client) {
  if (!(await tableExists(client, "users"))) return;

  if (!(await columnExists(client, "users", "role"))) {
    await client.execute(
      "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'super_admin'",
    );
  }
  if (!(await columnExists(client, "users", "center_id"))) {
    await client.execute("ALTER TABLE users ADD COLUMN center_id INTEGER REFERENCES centers(id)");
  }

  await client.execute(
    "UPDATE users SET role = 'super_admin' WHERE role IS NULL OR role = ''",
  );
}

async function getSchemaVersion(client: Client): Promise<number> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY
    )
  `);
  const row = await client.execute("SELECT MAX(version) as v FROM schema_migrations");
  return Number(row.rows[0]?.v ?? 0);
}

async function setSchemaVersion(client: Client, version: number) {
  await client.execute({
    sql: "INSERT OR REPLACE INTO schema_migrations (version) VALUES (?)",
    args: [version],
  });
}

async function migrateZones(client: Client, defaultCenterId: number) {
  if (!(await tableExists(client, "zones"))) return;

  if (await columnExists(client, "zones", "center_id")) {
    await client.execute({
      sql: "UPDATE zones SET center_id = ? WHERE center_id IS NULL",
      args: [defaultCenterId],
    });
    await client.execute({
      sql: "UPDATE zones SET sub_code = '' WHERE sub_code IS NULL",
      args: [],
    });
    return;
  }

  const sourceTable = (await tableExists(client, "zones_legacy")) ? "zones_legacy" : "zones";
  const oldZones = await client.execute(`SELECT * FROM ${sourceTable} ORDER BY id`);

  if (sourceTable === "zones") {
    await client.execute("ALTER TABLE zones RENAME TO zones_legacy");
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS zones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      base_code TEXT NOT NULL,
      sub_code TEXT NOT NULL DEFAULT '',
      code TEXT NOT NULL,
      name TEXT,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS zones_center_base_sub ON zones (center_id, base_code, sub_code)
  `);

  for (const row of oldZones.rows) {
    const code = String(row.code);
    const { baseCode, subCode } = parseZoneCode(code);
    const sortOrder = zoneCodeToSortOrder(code);
    await client.execute({
      sql: `INSERT OR IGNORE INTO zones (id, center_id, base_code, sub_code, code, name, description, is_active, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        row.id,
        defaultCenterId,
        baseCode,
        subCode,
        code,
        row.name,
        row.description,
        row.is_active,
        sortOrder,
        row.created_at,
        row.updated_at,
      ],
    });
  }

  if (await tableExists(client, "zones_legacy")) {
    await client.execute("DROP TABLE zones_legacy");
  }
}

async function migrateDrivers(client: Client, defaultCenterId: number) {
  if (!(await tableExists(client, "drivers"))) return;

  if (await columnExists(client, "drivers", "center_id")) {
    await client.execute({
      sql: "UPDATE drivers SET center_id = ? WHERE center_id IS NULL",
      args: [defaultCenterId],
    });
    return;
  }

  const oldDrivers = await client.execute("SELECT * FROM drivers ORDER BY id");

  await client.execute("ALTER TABLE drivers RENAME TO drivers_legacy");

  await client.execute(`
    CREATE TABLE drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kurly_id TEXT,
      kurly_account_name TEXT,
      account_type TEXT NOT NULL DEFAULT 'regular' CHECK (account_type IN ('regular', 'spare')),
      default_time_slot TEXT CHECK (default_time_slot IN ('first', 'second')),
      max_capacity INTEGER,
      capability_note TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  for (const row of oldDrivers.rows) {
    await client.execute({
      sql: `INSERT INTO drivers (id, center_id, name, account_type, default_time_slot, max_capacity, capability_note, is_active, created_at, updated_at)
            VALUES (?, ?, ?, 'regular', ?, ?, ?, ?, ?, ?)`,
      args: [
        row.id,
        defaultCenterId,
        row.name,
        row.default_time_slot,
        row.max_capacity,
        row.capability_note,
        row.is_active,
        row.created_at,
        row.updated_at,
      ],
    });
  }

  await client.execute("DROP TABLE drivers_legacy");
}

async function createBorrowRulesTable(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS driver_id_borrow_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      actual_driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
      kurly_driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
      is_active INTEGER NOT NULL DEFAULT 1,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS borrow_rules_center_actual
    ON driver_id_borrow_rules (center_id, actual_driver_id)
  `);
}

async function createCentersTables(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS centers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      use_sub_zones INTEGER NOT NULL DEFAULT 0,
      id_borrow_policy TEXT NOT NULL DEFAULT 'fixed_1_1'
        CHECK (id_borrow_policy IN ('fixed_1_1', 'daily_override')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS center_sub_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS center_sub_codes_center_label
    ON center_sub_codes (center_id, label)
  `);
}

export async function runV1bMigrations(client: Client) {
  await client.execute("PRAGMA busy_timeout = 10000");

  const version = await getSchemaVersion(client);
  if (version >= 2) return;

  await createCentersTables(client);
  const { daeguId } = await seedDefaultCenters(client);
  await migrateUsers(client);
  await migrateZones(client, daeguId);
  await migrateDrivers(client, daeguId);
  await createBorrowRulesTable(client);
  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS drivers_center_kurly_id
    ON drivers (center_id, kurly_id)
    WHERE kurly_id IS NOT NULL AND kurly_id != ''
  `);

  await setSchemaVersion(client, 2);
}
