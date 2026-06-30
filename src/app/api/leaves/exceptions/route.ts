import { eq } from "drizzle-orm";
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
import { driverLeaveExceptions, drivers } from "@/lib/db/schema";
import { leaveExceptionCreateSchema } from "@/lib/validations";

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

    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let rows = await db
      .select()
      .from(driverLeaveExceptions)
      .where(eq(driverLeaveExceptions.centerId, centerId));

    if (from) rows = rows.filter((r) => r.leaveDate >= from);
    if (to) rows = rows.filter((r) => r.leaveDate <= to);

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    await ensureDbReady();
    const body = await request.json();
    const parsed = leaveExceptionCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;
    if (user.role === "center_manager" && user.centerId !== data.centerId) {
      return forbiddenResponse();
    }

    const [driver] = await db
      .select()
      .from(drivers)
      .where(eq(drivers.id, data.driverId))
      .limit(1);
    if (!driver || driver.centerId !== data.centerId) {
      return badRequestResponse("같은 센터 기사만 등록할 수 있습니다.");
    }

    const now = new Date().toISOString();
    const [created] = await db
      .insert(driverLeaveExceptions)
      .values({
        centerId: data.centerId,
        driverId: data.driverId,
        timeSlot: data.timeSlot,
        leaveDate: data.leaveDate,
        kind: data.kind ?? "leave",
        note: data.note ?? null,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("UNIQUE")
        ? "이미 등록된 날짜입니다."
        : undefined;
    if (message) return badRequestResponse(message);
    return handleApiError(error);
  }
}
