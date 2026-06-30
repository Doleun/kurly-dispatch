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
import { drivers, zoneMappings, zones } from "@/lib/db/schema";
import { zoneMappingCreateSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return unauthorizedResponse();

    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const centerId = resolveCenterId(user, parseCenterIdParam(searchParams.get("centerId")));

    const rows = await db.select().from(zoneMappings);
    const zoneRows = await db.select().from(zones);
    const zoneCenterMap = new Map(zoneRows.map((z) => [z.id, z.centerId]));

    let filtered = rows.filter((m) => {
      const zCenter = zoneCenterMap.get(m.zoneId);
      return zCenter !== undefined;
    });

    if (centerId) {
      if (user.role === "center_manager" && user.centerId !== centerId) {
        return forbiddenResponse();
      }
      filtered = filtered.filter((m) => zoneCenterMap.get(m.zoneId) === centerId);
    } else if (user.role === "center_manager" && user.centerId) {
      filtered = filtered.filter((m) => zoneCenterMap.get(m.zoneId) === user.centerId);
    }

    return NextResponse.json(filtered);
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
    const parsed = zoneMappingCreateSchema.safeParse(body);
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
    const [zone] = await db.select().from(zones).where(eq(zones.id, data.zoneId)).limit(1);

    if (!driver || !zone) return badRequestResponse("기사 또는 구역을 찾을 수 없습니다.");
    if (driver.centerId !== data.centerId || zone.centerId !== data.centerId) {
      return badRequestResponse("같은 센터의 기사·구역만 연결할 수 있습니다.");
    }
    if (driver.accountType === "spare") {
      return badRequestResponse("예비 ID는 고정 구역 매핑 대상이 아닙니다.");
    }

    const [created] = await db
      .insert(zoneMappings)
      .values({
        driverId: data.driverId,
        zoneId: data.zoneId,
        timeSlot: data.timeSlot,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("UNIQUE")
        ? "이미 등록된 매핑입니다."
        : "매핑 저장 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
