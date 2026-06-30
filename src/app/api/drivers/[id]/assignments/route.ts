import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  badRequestResponse,
  forbiddenResponse,
  handleApiError,
  unauthorizedResponse,
} from "@/lib/api-utils";
import { getAuthUser } from "@/lib/center-access";
import { db, ensureDbReady } from "@/lib/db";
import { drivers, randomPoolMembers, zoneMappings, zones } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

const assignmentsSchema = z.object({
  centerId: z.number().int().positive(),
  random: z.boolean(),
  zoneIds: z.array(z.number().int().positive()),
});

export async function PUT(request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const driverId = Number((await params).id);
    if (Number.isNaN(driverId)) return badRequestResponse("잘못된 ID입니다.");

    await ensureDbReady();
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
    if (!driver) {
      return NextResponse.json({ error: "기사를 찾을 수 없습니다." }, { status: 404 });
    }

    if (user.role === "center_manager" && user.centerId !== driver.centerId) {
      return forbiddenResponse();
    }

    if (driver.accountType === "spare") {
      return badRequestResponse("예비 ID는 구역·랜덤 배정 대상이 아닙니다.");
    }

    const timeSlot = driver.defaultTimeSlot ?? "first";

    const body = await request.json();
    const parsed = assignmentsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { centerId, random, zoneIds } = parsed.data;
    if (driver.centerId !== centerId) {
      return badRequestResponse("같은 센터 기사만 배정할 수 있습니다.");
    }

    if (random && zoneIds.length > 0) {
      return badRequestResponse("랜덤 후보와 고정 구역은 동시에 지정할 수 없습니다.");
    }

    const centerZones = await db
      .select({ id: zones.id })
      .from(zones)
      .where(eq(zones.centerId, centerId));
    const centerZoneIds = new Set(centerZones.map((z) => z.id));

    for (const zoneId of zoneIds) {
      if (!centerZoneIds.has(zoneId)) {
        return badRequestResponse("이 센터 구역만 배정할 수 있습니다.");
      }
    }

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

    const mappings = await db
      .select()
      .from(zoneMappings)
      .where(eq(zoneMappings.driverId, driverId));
    const pool = await db
      .select()
      .from(randomPoolMembers)
      .where(eq(randomPoolMembers.driverId, driverId));

    return NextResponse.json({ mappings, pool, timeSlot });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("UNIQUE")
        ? "이미 다른 기사에게 배정된 구역이 있습니다."
        : undefined;
    if (message) return badRequestResponse(message);
    return handleApiError(error);
  }
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    const driverId = Number((await params).id);
    if (Number.isNaN(driverId)) return badRequestResponse("잘못된 ID입니다.");

    await ensureDbReady();
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
    if (!driver) {
      return NextResponse.json({ error: "기사를 찾을 수 없습니다." }, { status: 404 });
    }

    if (user.role === "center_manager" && user.centerId !== driver.centerId) {
      return forbiddenResponse();
    }

    const mappings = await db
      .select()
      .from(zoneMappings)
      .where(eq(zoneMappings.driverId, driverId));
    const pool = await db
      .select()
      .from(randomPoolMembers)
      .where(eq(randomPoolMembers.driverId, driverId));

    return NextResponse.json({
      mappings,
      pool,
      timeSlot: driver.defaultTimeSlot ?? "first",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
