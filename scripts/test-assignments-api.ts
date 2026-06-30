import { eq } from "drizzle-orm";
import { db, ensureDbReady } from "../src/lib/db";
import { drivers, randomPoolMembers, zoneMappings, zones } from "../src/lib/db/schema";

async function putAssignments(
  driverId: number,
  centerId: number,
  random: boolean,
  zoneIds: number[],
) {
  await ensureDbReady();

  const [driver] = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
  if (!driver) throw new Error("driver not found");

  const timeSlot = driver.defaultTimeSlot ?? "first";

  const centerZones = await db
    .select({ id: zones.id })
    .from(zones)
    .where(eq(zones.centerId, centerId));
  const centerZoneIds = new Set(centerZones.map((z) => z.id));

  const driverMappings = await db
    .select()
    .from(zoneMappings)
    .where(eq(zoneMappings.driverId, driverId));

  for (const mapping of driverMappings) {
    if (centerZoneIds.has(mapping.zoneId)) {
      await db.delete(zoneMappings).where(eq(zoneMappings.id, mapping.id));
    }
  }

  const poolRows = await db
    .select()
    .from(randomPoolMembers)
    .where(eq(randomPoolMembers.driverId, driverId));

  for (const row of poolRows) {
    await db.delete(randomPoolMembers).where(eq(randomPoolMembers.id, row.id));
  }

  if (random) {
    await db.insert(randomPoolMembers).values({ driverId, timeSlot });
  } else {
    for (const zoneId of zoneIds) {
      await db.insert(zoneMappings).values({ driverId, zoneId, timeSlot });
    }
  }

  console.log("ok", { driverId, random, zoneIds, timeSlot });
}

async function main() {
  await putAssignments(10, 1, false, [12]);
  await putAssignments(11, 1, true, []);
}

main().catch((e) => {
  console.error("failed", e);
  process.exit(1);
});
