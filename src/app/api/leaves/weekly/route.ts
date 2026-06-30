import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  badRequestResponse,
  forbiddenResponse,
  handleApiError,
  parseCenterIdParam,
  unauthorizedResponse,
} from "@/lib/api-utils";
import { getAuthUser, resolveCenterId } from "@/lib/center-access";
import { db, ensureDbReady } from "@/lib/db";
import { driverWeeklyLeaves, drivers } from "@/lib/db/schema";
import type { TimeSlot, Weekday } from "@/lib/db/schema";
import { weeklyLeavesBulkSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const centerId = resolveCenterId(user, parseCenterIdParam(searchParams.get("centerId")));
    if (!centerId) return badRequestResponse("센터를 선택하세요.");

    if (user.role === "center_manager" && user.centerId !== centerId) {
      return forbiddenResponse();
    }

    const timeSlot = searchParams.get("timeSlot") as TimeSlot | null;
    if (timeSlot !== "first" && timeSlot !== "second") {
      return badRequestResponse("timeSlot(first|second)이 필요합니다.");
    }

    const rows = await db
      .select()
      .from(driverWeeklyLeaves)
      .where(
        and(
          eq(driverWeeklyLeaves.centerId, centerId),
          eq(driverWeeklyLeaves.timeSlot, timeSlot),
        ),
      );

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    await ensureDbReady();
    const body = await request.json();
    const parsed = weeklyLeavesBulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { centerId, timeSlot, leaves } = parsed.data;
    if (user.role === "center_manager" && user.centerId !== centerId) {
      return forbiddenResponse();
    }

    const centerDrivers = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.centerId, centerId));
    const driverIds = new Set(centerDrivers.map((d) => d.id));

    for (const leaf of leaves) {
      if (!driverIds.has(leaf.driverId)) {
        return badRequestResponse("같은 센터 기사만 등록할 수 있습니다.");
      }
    }

    await db
      .delete(driverWeeklyLeaves)
      .where(
        and(
          eq(driverWeeklyLeaves.centerId, centerId),
          eq(driverWeeklyLeaves.timeSlot, timeSlot),
        ),
      );

    const now = new Date().toISOString();
    if (leaves.length > 0) {
      await db.insert(driverWeeklyLeaves).values(
        leaves.map((leaf) => ({
          centerId,
          driverId: leaf.driverId,
          timeSlot,
          weekday: leaf.weekday as Weekday,
          note: leaf.note ?? null,
          updatedAt: now,
        })),
      );
    }

    const rows = await db
      .select()
      .from(driverWeeklyLeaves)
      .where(
        and(
          eq(driverWeeklyLeaves.centerId, centerId),
          eq(driverWeeklyLeaves.timeSlot, timeSlot),
        ),
      );

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}
