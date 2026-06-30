import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/lib/db/schema";
import { zoneMappings, zones } from "../src/lib/db/schema";

const client = createClient({ url: "file:./data/kurly.db" });
const db = drizzle(client, { schema });

async function main() {
  const driverId = 10;
  const centerId = 1;

  const centerZones = await db.select({ id: zones.id, code: zones.code }).from(zones).where(eq(zones.centerId, centerId));
  console.log("zones sample", centerZones.filter((z) => z.code.startsWith("20")).slice(0, 3));

  const zone20 = centerZones.find((z) => z.code === "20-1");
  if (!zone20) {
    console.log("no 20-1 zone");
    return;
  }

  await db.delete(zoneMappings).where(eq(zoneMappings.driverId, driverId));

  try {
    await db.insert(zoneMappings).values({ driverId, zoneId: zone20.id, timeSlot: "first" });
    console.log("insert ok", zone20);
  } catch (e) {
    console.error("insert failed", e);
  }

  const idx = await client.execute("SELECT name, sql FROM sqlite_master WHERE tbl_name='zone_mappings'");
  console.log("indexes", idx.rows);

  const m = await client.execute("SELECT zm.*, z.code FROM zone_mappings zm JOIN zones z ON z.id=zm.zone_id WHERE zm.zone_id=12");
  console.log("mappings for zone 12:", m.rows);

  const d10 = await client.execute("SELECT id, name, default_time_slot FROM drivers WHERE id=10");
  console.log("driver 10", d10.rows);
}

main();
