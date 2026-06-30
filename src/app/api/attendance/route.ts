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
import { driverLeaveExceptions, driverWeeklyLeaves, drivers } from "@/lib/db/schema";
import type { TimeSlot } from "@/lib/db/schema";
import { isDriverWorkingOnDate, resolveAttendance } from "@/lib/leave-utils";

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

    const date = searchParams.get("date");
    const timeSlot = searchParams.get("timeSlot") as TimeSlot | null;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequestResponse("date(YYYY-MM-DD)가 필요합니다.");
    }
    if (timeSlot !== "first" && timeSlot !== "second") {
      return badRequestResponse("timeSlot(first|second)이 필요합니다.");
    }

    const [allDrivers, weeklyLeaves, exceptions] = await Promise.all([
      db.select().from(drivers).where(eq(drivers.centerId, centerId)),
      db
        .select()
        .from(driverWeeklyLeaves)
        .where(
          and(
            eq(driverWeeklyLeaves.centerId, centerId),
            eq(driverWeeklyLeaves.timeSlot, timeSlot),
          ),
        ),
      db
        .select()
        .from(driverLeaveExceptions)
        .where(
          and(
            eq(driverLeaveExceptions.centerId, centerId),
            eq(driverLeaveExceptions.timeSlot, timeSlot),
            eq(driverLeaveExceptions.leaveDate, date),
          ),
        ),
    ]);

    const regular = allDrivers.filter(
      (d) => d.accountType === "regular" && d.defaultTimeSlot === timeSlot && d.isActive,
    );

    const working = regular.filter((d) =>
      isDriverWorkingOnDate(d, timeSlot, date, weeklyLeaves, exceptions),
    );
    const onLeave = regular.filter((d) =>
      resolveAttendance({
        driver: d,
        timeSlot,
        date,
        weeklyLeaves,
        exceptions,
      }) === "leave",
    );

    working.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    onLeave.sort((a, b) => a.name.localeCompare(b.name, "ko"));

    return NextResponse.json({
      date,
      timeSlot,
      centerId,
      working,
      onLeave,
      counts: { working: working.length, onLeave: onLeave.length, total: regular.length },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
