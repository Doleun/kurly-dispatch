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
import { drivers, randomPoolMembers } from "@/lib/db/schema";
import { randomPoolCreateSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const centerId = resolveCenterId(user, parseCenterIdParam(searchParams.get("centerId")));

    const driverRows = await db.select().from(drivers);
    const driverCenterMap = new Map(driverRows.map((d) => [d.id, d.centerId]));

    let rows = await db.select().from(randomPoolMembers);
    if (centerId) {
      if (user.role === "center_manager" && user.centerId !== centerId) {
        return forbiddenResponse();
      }
      rows = rows.filter((r) => driverCenterMap.get(r.driverId) === centerId);
    } else if (user.role === "center_manager" && user.centerId) {
      rows = rows.filter((r) => driverCenterMap.get(r.driverId) === user.centerId);
    }

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
    const parsed = randomPoolCreateSchema.safeParse(body);
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

    const [driver] = await db.select().from(drivers).where(eq(drivers.id, data.driverId)).limit(1);
    if (!driver) return badRequestResponse("기사를 찾을 수 없습니다.");
    if (driver.centerId !== data.centerId) {
      return badRequestResponse("같은 센터 기사만 등록할 수 있습니다.");
    }
    if (driver.accountType === "spare") {
      return badRequestResponse("예비 ID는 랜덤 후보군 대상이 아닙니다.");
    }

    const [created] = await db
      .insert(randomPoolMembers)
      .values({
        driverId: data.driverId,
        timeSlot: data.timeSlot,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("UNIQUE")
        ? "이미 후보군에 등록된 기사입니다."
        : "등록 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
